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
export const STRIPE_PRICE_MAP = {
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
} as const;

export class SubscriptionService {
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return sub ?? null;
  }

  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    const existing = await this.getUserSubscription(userId);
    if (existing) return existing;

    const [created] = await db
      .insert(subscriptions)
      .values({ userId, plan: "free", status: "active" })
      .returning();

    return created;
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

    if (usage) return usage;

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

  async getSubscriptionDetails(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.getUserUsage(userId);
    const limits = planLimits[subscription.plan];

    return { subscription, usage, limits };
  }

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
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan,
        status: "active",
        stripeCustomerId: stripe?.customerId ?? null,
        stripeSubscriptionId: stripe?.subscriptionId ?? null,
        stripePriceId: stripe?.priceId ?? null,
        currentPeriodStart: stripe?.currentPeriodStart ?? null,
        currentPeriodEnd: stripe?.currentPeriodEnd ?? null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    return updated;
  }

  async cancelSubscription(userId: string) {
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



