import { db } from "./db";
import {
  subscriptions,
  usageTracking,
  type Subscription,
  type UsageTracking,
  type SubscriptionPlan,
  planLimits,
  type ChatMode,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Stripe Price mapping
 * Alinhado com:
 * - Planos: free | pro | premium
 * - Moedas: EUR | USD | BRL | INR
 * - Períodos: monthly | yearly
 */
export const STRIPE_PRICE_MAP: Record<
  SubscriptionPlan,
  Partial<
    Record<
      "monthly" | "yearly",
      Partial<Record<"EUR" | "USD" | "BRL" | "INR", string>>
    >
  >
> = {
  free: {},

  pro: {
    monthly: {
      EUR: process.env.STRIPE_PRICE_PRO_EUR_MONTH!,
      USD: process.env.STRIPE_PRICE_PRO_USD_MONTH!,
      BRL: process.env.STRIPE_PRICE_PRO_BRL_MONTH!,
      INR: process.env.STRIPE_PRICE_PRO_INR_MONTH!,
    },
    yearly: {
      EUR: process.env.STRIPE_PRICE_PRO_EUR_YEAR!,
      USD: process.env.STRIPE_PRICE_PRO_USD_YEAR!,
      BRL: process.env.STRIPE_PRICE_PRO_BRL_YEAR!,
      INR: process.env.STRIPE_PRICE_PRO_INR_YEAR!,
    },
  },

  premium: {
    monthly: {
      EUR: process.env.STRIPE_PRICE_PREMIUM_EUR_MONTH!,
      USD: process.env.STRIPE_PRICE_PREMIUM_USD_MONTH!,
      BRL: process.env.STRIPE_PRICE_PREMIUM_BRL_MONTH!,
      INR: process.env.STRIPE_PRICE_PREMIUM_INR_MONTH!,
    },
    yearly: {
      EUR: process.env.STRIPE_PRICE_PREMIUM_EUR_YEAR!,
      USD: process.env.STRIPE_PRICE_PREMIUM_USD_YEAR!,
      BRL: process.env.STRIPE_PRICE_PREMIUM_BRL_YEAR!,
      INR: process.env.STRIPE_PRICE_PREMIUM_INR_YEAR!,
    },
  },
};

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
   * Get or create subscription (defaults to free)
   */
  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    let subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      const [created] = await db
        .insert(subscriptions)
        .values({
          userId,
          plan: "free",
          status: "active",
        })
        .returning();

      subscription = created;
    }

    return subscription;
  }

  /**
   * Get current month's usage
   */
  async getUserUsage(userId: string): Promise<UsageTracking> {
    const month = new Date().toISOString().slice(0, 7);

    const [usage] = await db
      .select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.month, month)
        )
      );

    if (!usage) {
      const [created] = await db
        .insert(usageTracking)
        .values({
          userId,
          month,
          uploadsCount: 0,
          chatMessagesCount: 0,
          summariesGenerated: 0,
        })
        .returning();

      return created;
    }

    return usage;
  }

  /**
   * Upload permissions
   */
  async canUpload(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan];

    if (limits.uploadsPerMonth === -1) return { allowed: true };

    if (usage.uploadsCount >= limits.uploadsPerMonth) {
      return {
        allowed: false,
        errorCode: "UPLOAD_LIMIT_REACHED",
        params: { limit: limits.uploadsPerMonth, planName: limits.name },
      };
    }

    return { allowed: true };
  }

  async incrementUploadCount(userId: string) {
    const month = new Date().toISOString().slice(0, 7);

    await db
      .insert(usageTracking)
      .values({
        userId,
        month,
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
   * Chat permissions
   */
  async canSendChatMessage(userId: string, mode: ChatMode) {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan];

    if (!limits.chatModes.includes(mode)) {
      return {
        allowed: false,
        errorCode: "CHAT_MODE_NOT_AVAILABLE",
        params: { mode, planName: limits.name },
      };
    }

    if (limits.dailyChatLimit !== -1 && usage.chatMessagesCount >= limits.dailyChatLimit) {
      return {
        allowed: false,
        errorCode: "CHAT_LIMIT_REACHED",
        params: { limit: limits.dailyChatLimit, planName: limits.name },
      };
    }

    return { allowed: true };
  }

  async incrementChatMessageCount(userId: string) {
    const month = new Date().toISOString().slice(0, 7);

    await db
      .insert(usageTracking)
      .values({
        userId,
        month,
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
   * Summary permissions
   */
  async canGenerateSummary(userId: string, wordCount: number) {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = planLimits[subscription.plan];

    if (limits.maxSummaryWords === -1) return { allowed: true };

    if (wordCount > limits.maxSummaryWords) {
      return {
        allowed: false,
        errorCode: "SUMMARY_WORD_LIMIT_EXCEEDED",
        params: {
          wordCount,
          limit: limits.maxSummaryWords,
          planName: limits.name,
        },
      };
    }

    return { allowed: true };
  }

  async incrementSummaryCount(userId: string) {
    const month = new Date().toISOString().slice(0, 7);

    await db
      .insert(usageTracking)
      .values({
        userId,
        month,
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
   * Update subscription after Stripe checkout / webhook
   */
  async updateSubscriptionPlan(
    userId: string,
    plan: SubscriptionPlan,
    stripe?: {
      customerId?: string;
      subscriptionId?: string;
      priceId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    }
  ) {
    const existing = await this.getUserSubscription(userId);

    if (existing) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          plan,
          status: "active",
          stripeCustomerId: stripe?.customerId ?? existing.stripeCustomerId,
          stripeSubscriptionId: stripe?.subscriptionId ?? existing.stripeSubscriptionId,
          stripePriceId: stripe?.priceId ?? existing.stripePriceId,
          currentPeriodStart: stripe?.currentPeriodStart ?? existing.currentPeriodStart,
          currentPeriodEnd: stripe?.currentPeriodEnd ?? existing.currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(subscriptions)
      .values({
        userId,
        plan,
        status: "active",
        stripeCustomerId: stripe?.customerId,
        stripeSubscriptionId: stripe?.subscriptionId,
        stripePriceId: stripe?.priceId,
        currentPeriodStart: stripe?.currentPeriodStart,
        currentPeriodEnd: stripe?.currentPeriodEnd,
      })
      .returning();

    return created;
  }

  /**
   * Cancel subscription (revert to free)
   */
  async cancelSubscription(userId: string) {
    const sub = await this.getUserSubscription(userId);
    if (!sub || sub.plan === "free") {
      throw new Error("No active paid subscription");
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: "free",
        status: "canceled",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    return updated;
  }
}

export const subscriptionService = new SubscriptionService();
