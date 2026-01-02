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
 * Planos: free | pro | premium
 * Moedas: EUR | USD | BRL | INR
 * Períodos: monthly | yearly
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
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    return subscription || null;
  }

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
   * ✅ MÉTODO QUE FALTAVA E QUE QUEBRAVA TUDO
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

