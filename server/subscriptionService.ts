import { db } from "./db";
import { subscriptions, usageTracking, users, type Subscription, type UsageTracking, type SubscriptionPlan, planLimits, type ChatMode } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

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
   * Get plan limits for a given plan
   */
  getPlanLimits(plan: string) {
    return planLimits[plan as SubscriptionPlan];
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
   * Check if user can create a subject
   */
  async canCreateSubject(userId: string, currentCount: number): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (limits.maxSubjects === -1) {
      return { allowed: true };
    }

    if (currentCount >= limits.maxSubjects) {
      return {
        allowed: false,
        errorCode: 'SUBJECT_LIMIT_REACHED',
        params: { limit: limits.maxSubjects, planName: limits.name },
        reason: `Subject limit reached: ${limits.maxSubjects}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can create a topic
   */
  async canCreateTopic(userId: string, currentCount: number): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (limits.maxTopics === -1) {
      return { allowed: true };
    }

    if (currentCount >= limits.maxTopics) {
      return {
        allowed: false,
        errorCode: 'TOPIC_LIMIT_REACHED',
        params: { limit: limits.maxTopics, planName: limits.name },
        reason: `Topic limit reached: ${limits.maxTopics}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can perform an upload
   */
  async canUpload(userId: string): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (limits.uploadsPerMonth === -1) {
      return { allowed: true };
    }

    if (usage.uploadsCount >= limits.uploadsPerMonth) {
      return {
        allowed: false,
        errorCode: 'UPLOAD_LIMIT_REACHED',
        params: { limit: limits.uploadsPerMonth, planName: limits.name },
        reason: `Upload limit reached: ${limits.uploadsPerMonth}`,
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
          uploadsCount: sql`${usageTracking.uploadsCount} + 1`,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Check if user can send chat message
   */
  async canSendChatMessage(userId: string, mode: ChatMode): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    // Check if mode is allowed for this plan
    if (!limits.chatModes.includes(mode)) {
      return {
        allowed: false,
        errorCode: 'CHAT_MODE_NOT_AVAILABLE',
        params: { mode, planName: limits.name },
        reason: `Chat mode not available: ${mode}`,
      };
    }

    // Check daily limit
    if (limits.dailyChatLimit === -1) {
      return { allowed: true };
    }

    if (usage.chatMessagesCount >= limits.dailyChatLimit) {
      return {
        allowed: false,
        errorCode: 'CHAT_LIMIT_REACHED',
        params: { limit: limits.dailyChatLimit, planName: limits.name },
        reason: `Chat limit reached: ${limits.dailyChatLimit}`,
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
          chatMessagesCount: sql`${usageTracking.chatMessagesCount} + 1`,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Check if user can create manual flashcards
   * All plans (FREE, PRO, PREMIUM) can create manual flashcards
   */
  async canCreateManualFlashcard(userId: string): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    // All users can create manual flashcards
    return { allowed: true };
  }

  async canUseLearningStyle(userId: string, learningStyle: string): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (!limits.allowedLearningStyles.includes(learningStyle as any)) {
      return {
        allowed: false,
        errorCode: 'LEARNING_STYLE_NOT_AVAILABLE',
        params: { learningStyle, planName: limits.name },
        reason: `Learning style not available: ${learningStyle}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can generate summary
   */
  async canGenerateSummary(userId: string, wordCount: number): Promise<{ allowed: boolean; reason?: string; errorCode?: string; params?: any }> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan as SubscriptionPlan];

    if (limits.maxSummaryWords === -1) {
      return { allowed: true };
    }

    if (wordCount > limits.maxSummaryWords) {
      return {
        allowed: false,
        errorCode: 'SUMMARY_WORD_LIMIT_EXCEEDED',
        params: { wordCount, limit: limits.maxSummaryWords, planName: limits.name },
        reason: `Summary word limit exceeded: ${wordCount}/${limits.maxSummaryWords}`,
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
          summariesGenerated: sql`${usageTracking.summariesGenerated} + 1`,
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
   * Cancel subscription and immediately revert to free plan
   */
  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.plan === "free") {
      throw new Error("Already on free plan");
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: "free",
        status: "canceled",
        cancelAtPeriodEnd: undefined,
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
        stripePriceId: undefined,
        currentPeriodStart: undefined,
        currentPeriodEnd: undefined,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

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
