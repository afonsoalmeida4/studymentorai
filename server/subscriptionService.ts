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
  /* -------------------- HELPERS -------------------- */

  normalizeCurrency(currency?: string): "EUR" | "USD" | "BRL" | "INR" {
    switch ((currency || "").toLowerCase()) {
      case "usd":
        return "USD";
      case "brl":
        return "BRL";
      case "inr":
        return "INR";
      default:
        return "EUR";
    }
  }

  getStripePriceId(
    plan: SubscriptionPlan,
    billingPeriod: "monthly" | "yearly",
    currency: string
  ): string {
    const normalizedCurrency = this.normalizeCurrency(currency);
    const priceId =
      STRIPE_PRICE_MAP[plan]?.[billingPeriod]?.[normalizedCurrency];

    if (!priceId) {
      throw new Error(
        `Missing Stripe Price ID for ${plan} / ${billingPeriod} / ${normalizedCurrency}`
      );
    }

    return priceId;
  }

  /* -------------------- SUBSCRIPTION -------------------- */

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
          stripeSubscriptionId:
            stripe?.subscriptionId ?? existing.stripeSubscriptionId,
          stripePriceId: stripe?.priceId ?? existing.stripePriceId,
          currentPeriodStart:
            stripe?.currentPeriodStart ?? existing.currentPeriodStart,
          currentPeriodEnd:
            stripe?.currentPeriodEnd ?? existing.currentPeriodEnd,
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

  /* -------------------- USAGE / LIMITS -------------------- */

  async getUserUsage(userId: string): Promise<UsageTracking> {
    const month = new Date().toISOString().slice(0, 7);

    const [usage] = await db
      .select()
      .from(usageTracking)
      .where(
        and(eq(usageTracking.userId, userId), eq(usageTracking.month, month))
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

  getPlanLimits(plan: SubscriptionPlan) {
    return planLimits[plan];
  }
}

export const subscriptionService = new SubscriptionService();

