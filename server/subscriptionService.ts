import { db } from "./db";
import { subscriptions, usageTracking, users, type Subscription, type UsageTracking, type SubscriptionPlan, planLimits, type ChatMode } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class SubscriptionService {
  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    return subscription || null;
  }

  /**
   * Get or create subscription (defaults to free plan)
   */
  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    let subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      const [newSubscription] = await db
        .insert(subscriptions)
        .values({
          userId,
          plan: "free",
          status: "active",
        })
        .returning();
      subscription = newSubscription;
    }

    return subscription;
  }

  /**
   * Get current month's usage for user
   */
  async getUserUsage(userId: string): Promise<UsageTracking> {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const [usage] = await db
      .select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.month, currentMonth)
        )
      );

    if (!usage) {
      const [newUsage] = await db
        .insert(usageTracking)
        .values({
          userId,
          month: currentMonth,
          uploadsCount: 0,
          chatMessagesCount: 0,
          summariesGenerated: 0,
        })
        .returning();
      return newUsage;
    }

    return usage;
  }

  /**
   * Check if user can perform an upload
   */
  async canUpload(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (limits.uploadsPerMonth === -1) {
      return { allowed: true };
    }

    if (usage.uploadsCount >= limits.uploadsPerMonth) {
      return {
        allowed: false,
        reason: `Atingiste o limite de ${limits.uploadsPerMonth} uploads por mês do plano ${limits.name}. Faz upgrade para continuar!`,
      };
    }

    return { allowed: true };
  }

  /**
   * Increment upload count
   */
  async incrementUploadCount(userId: string): Promise<void> {
    const currentMonth = new Date().toISOString().substring(0, 7);

    await db
      .insert(usageTracking)
      .values({
        userId,
        month: currentMonth,
        uploadsCount: 1,
        chatMessagesCount: 0,
        summariesGenerated: 0,
      })
      .onConflictDoUpdate({
        target: [usageTracking.userId, usageTracking.month],
        set: {
          uploadsCount: db.raw(`${usageTracking.uploadsCount.name} + 1`),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Check if user can send chat message
   */
  async canSendChatMessage(userId: string, mode: ChatMode): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    // Check if mode is allowed for this plan
    if (!limits.chatModes.includes(mode)) {
      return {
        allowed: false,
        reason: `O modo ${mode === "existential" ? "Existencial" : "Estudo"} não está disponível no plano ${limits.name}. Faz upgrade para desbloquear!`,
      };
    }

    // Check daily limit
    if (limits.dailyChatLimit === -1) {
      return { allowed: true };
    }

    if (usage.chatMessagesCount >= limits.dailyChatLimit) {
      return {
        allowed: false,
        reason: `Atingiste o limite de ${limits.dailyChatLimit} mensagens por dia do plano ${limits.name}. Faz upgrade para chat ilimitado!`,
      };
    }

    return { allowed: true };
  }

  /**
   * Increment chat message count
   */
  async incrementChatMessageCount(userId: string): Promise<void> {
    const currentMonth = new Date().toISOString().substring(0, 7);

    await db
      .insert(usageTracking)
      .values({
        userId,
        month: currentMonth,
        uploadsCount: 0,
        chatMessagesCount: 1,
        summariesGenerated: 0,
      })
      .onConflictDoUpdate({
        target: [usageTracking.userId, usageTracking.month],
        set: {
          chatMessagesCount: db.raw(`${usageTracking.chatMessagesCount.name} + 1`),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Check if user can generate summary
   */
  async canGenerateSummary(userId: string, wordCount: number): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (limits.maxSummaryWords === -1) {
      return { allowed: true };
    }

    if (wordCount > limits.maxSummaryWords) {
      return {
        allowed: false,
        reason: `O resumo tem ${wordCount} palavras, mas o plano ${limits.name} permite até ${limits.maxSummaryWords} palavras. Faz upgrade para resumos maiores!`,
      };
    }

    return { allowed: true };
  }

  /**
   * Increment summary count
   */
  async incrementSummaryCount(userId: string): Promise<void> {
    const currentMonth = new Date().toISOString().substring(0, 7);

    await db
      .insert(usageTracking)
      .values({
        userId,
        month: currentMonth,
        uploadsCount: 0,
        chatMessagesCount: 0,
        summariesGenerated: 1,
      })
      .onConflictDoUpdate({
        target: [usageTracking.userId, usageTracking.month],
        set: {
          summariesGenerated: db.raw(`${usageTracking.summariesGenerated.name} + 1`),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Check if user has access to a feature
   */
  async hasFeatureAccess(userId: string, feature: keyof typeof planLimits.free): Promise<boolean> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    return !!limits[feature];
  }

  /**
   * Update user's subscription plan
   */
  async updateSubscriptionPlan(
    userId: string,
    plan: SubscriptionPlan,
    stripeData?: {
      customerId?: string;
      subscriptionId?: string;
      priceId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    }
  ): Promise<Subscription> {
    const existing = await this.getUserSubscription(userId);

    if (existing) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          plan,
          status: "active",
          stripeCustomerId: stripeData?.customerId || existing.stripeCustomerId,
          stripeSubscriptionId: stripeData?.subscriptionId || existing.stripeSubscriptionId,
          stripePriceId: stripeData?.priceId || existing.stripePriceId,
          currentPeriodStart: stripeData?.currentPeriodStart || existing.currentPeriodStart,
          currentPeriodEnd: stripeData?.currentPeriodEnd || existing.currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId))
        .returning();

      return updated;
    } else {
      const [newSub] = await db
        .insert(subscriptions)
        .values({
          userId,
          plan,
          status: "active",
          stripeCustomerId: stripeData?.customerId,
          stripeSubscriptionId: stripeData?.subscriptionId,
          stripePriceId: stripeData?.priceId,
          currentPeriodStart: stripeData?.currentPeriodStart,
          currentPeriodEnd: stripeData?.currentPeriodEnd,
        })
        .returning();

      return newSub;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<Subscription> {
    const [updated] = await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    if (!updated) {
      throw new Error("Subscription not found");
    }

    return updated;
  }

  /**
   * Get subscription details with usage stats
   */
  async getSubscriptionDetails(userId: string): Promise<{
    subscription: Subscription;
    usage: UsageTracking;
    limits: typeof planLimits[SubscriptionPlan];
  }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    return { subscription, usage, limits };
  }
}

export const subscriptionService = new SubscriptionService();
