/**
 * Usage Limits Service
 * 
 * Enforces monthly usage limits per subscription plan.
 * - Feature limits are visible to users (summaries, flashcards, quizzes, messages)
 * - Token limits are internal and invisible to users
 * 
 * Integrates with Stripe subscription status for billing cycle tracking.
 */

import { db } from "./db";
import { usageTracking, monthlyUsageLimits, type SubscriptionPlan } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { subscriptionService } from "./subscriptionService";

// Feature types that can be limited
export type LimitedFeature = "summaries" | "flashcards" | "quizzes" | "assistantMessages";

// Error messages translations
const LIMIT_EXCEEDED_MESSAGES: Record<string, Record<string, string>> = {
  pt: {
    summaries: "Atingiste o limite mensal de resumos. Faz upgrade do teu plano para continuar a usar as funcionalidades de IA.",
    flashcards: "Atingiste o limite mensal de flashcards. Faz upgrade do teu plano para continuar a usar as funcionalidades de IA.",
    quizzes: "Atingiste o limite mensal de quizzes. Faz upgrade do teu plano para continuar a usar as funcionalidades de IA.",
    assistantMessages: "Atingiste o limite mensal de mensagens do assistente. Faz upgrade do teu plano para continuar a usar as funcionalidades de IA.",
    tokens: "Faz upgrade do teu plano para continuar a usar as funcionalidades de IA.",
    featureNotAvailable: "Esta funcionalidade não está disponível no teu plano. Faz upgrade para desbloquear.",
  },
  en: {
    summaries: "You've reached your monthly summary limit. Upgrade your plan to continue using AI features.",
    flashcards: "You've reached your monthly flashcard limit. Upgrade your plan to continue using AI features.",
    quizzes: "You've reached your monthly quiz limit. Upgrade your plan to continue using AI features.",
    assistantMessages: "You've reached your monthly assistant message limit. Upgrade your plan to continue using AI features.",
    tokens: "Upgrade your plan to continue using AI features.",
    featureNotAvailable: "This feature is not available on your plan. Upgrade to unlock.",
  },
  es: {
    summaries: "Has alcanzado tu límite mensual de resúmenes. Actualiza tu plan para seguir usando las funciones de IA.",
    flashcards: "Has alcanzado tu límite mensual de flashcards. Actualiza tu plan para seguir usando las funciones de IA.",
    quizzes: "Has alcanzado tu límite mensual de quizzes. Actualiza tu plan para seguir usando las funciones de IA.",
    assistantMessages: "Has alcanzado tu límite mensual de mensajes del asistente. Actualiza tu plan para seguir usando las funciones de IA.",
    tokens: "Actualiza tu plan para seguir usando las funciones de IA.",
    featureNotAvailable: "Esta función no está disponible en tu plan. Actualiza para desbloquear.",
  },
  fr: {
    summaries: "Vous avez atteint votre limite mensuelle de résumés. Mettez à niveau votre plan pour continuer à utiliser les fonctionnalités IA.",
    flashcards: "Vous avez atteint votre limite mensuelle de flashcards. Mettez à niveau votre plan pour continuer à utiliser les fonctionnalités IA.",
    quizzes: "Vous avez atteint votre limite mensuelle de quiz. Mettez à niveau votre plan pour continuer à utiliser les fonctionnalités IA.",
    assistantMessages: "Vous avez atteint votre limite mensuelle de messages assistant. Mettez à niveau votre plan pour continuer à utiliser les fonctionnalités IA.",
    tokens: "Mettez à niveau votre plan pour continuer à utiliser les fonctionnalités IA.",
    featureNotAvailable: "Cette fonctionnalité n'est pas disponible sur votre plan. Mettez à niveau pour débloquer.",
  },
  de: {
    summaries: "Sie haben Ihr monatliches Zusammenfassungslimit erreicht. Upgraden Sie Ihren Plan, um KI-Funktionen weiter zu nutzen.",
    flashcards: "Sie haben Ihr monatliches Flashcard-Limit erreicht. Upgraden Sie Ihren Plan, um KI-Funktionen weiter zu nutzen.",
    quizzes: "Sie haben Ihr monatliches Quiz-Limit erreicht. Upgraden Sie Ihren Plan, um KI-Funktionen weiter zu nutzen.",
    assistantMessages: "Sie haben Ihr monatliches Assistenten-Nachrichtenlimit erreicht. Upgraden Sie Ihren Plan, um KI-Funktionen weiter zu nutzen.",
    tokens: "Upgraden Sie Ihren Plan, um KI-Funktionen weiter zu nutzen.",
    featureNotAvailable: "Diese Funktion ist in Ihrem Plan nicht verfügbar. Upgraden Sie, um sie freizuschalten.",
  },
  it: {
    summaries: "Hai raggiunto il limite mensile di riassunti. Aggiorna il tuo piano per continuare a usare le funzionalità IA.",
    flashcards: "Hai raggiunto il limite mensile di flashcard. Aggiorna il tuo piano per continuare a usare le funzionalità IA.",
    quizzes: "Hai raggiunto il limite mensile di quiz. Aggiorna il tuo piano per continuare a usare le funzionalità IA.",
    assistantMessages: "Hai raggiunto il limite mensile di messaggi dell'assistente. Aggiorna il tuo piano per continuare a usare le funzionalità IA.",
    tokens: "Aggiorna il tuo piano per continuare a usare le funzionalità IA.",
    featureNotAvailable: "Questa funzionalità non è disponibile nel tuo piano. Aggiorna per sbloccarla.",
  },
};

class UsageLimitsService {
  /**
   * Get the current month key in YYYY-MM format
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get or create usage tracking record for the current month
   */
  async getOrCreateUsageRecord(userId: string): Promise<typeof usageTracking.$inferSelect> {
    const currentMonth = this.getCurrentMonth();
    
    // Try to find existing record
    const existing = await db
      .select()
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.month, currentMonth)
      ))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new record for this month
    const [newRecord] = await db
      .insert(usageTracking)
      .values({
        userId,
        month: currentMonth,
        uploadsCount: 0,
        chatMessagesCount: 0,
        summariesGenerated: 0,
        flashcardsGenerated: 0,
        quizzesGenerated: 0,
        tokensUsed: 0,
      })
      .returning();

    return newRecord;
  }

  /**
   * Get user's subscription plan
   */
  async getUserPlan(userId: string): Promise<SubscriptionPlan> {
    try {
      const { subscription } = await subscriptionService.getSubscriptionDetails(userId);
      const plan = subscription.plan.toLowerCase() as SubscriptionPlan;
      
      // Map educational plans to premium
      if (plan === "educational" || plan === "educational_student") {
        return "premium";
      }
      
      if (plan === "pro" || plan === "premium") {
        return plan;
      }
      
      return "free";
    } catch (error) {
      console.error("[UsageLimits] Error getting user plan:", error);
      return "free";
    }
  }

  /**
   * Get limits for a plan
   */
  getPlanLimits(plan: SubscriptionPlan) {
    return monthlyUsageLimits[plan] || monthlyUsageLimits.free;
  }

  /**
   * Get translated error message
   */
  getErrorMessage(feature: LimitedFeature | "tokens" | "featureNotAvailable", language: string): string {
    const lang = LIMIT_EXCEEDED_MESSAGES[language] ? language : "en";
    return LIMIT_EXCEEDED_MESSAGES[lang][feature] || LIMIT_EXCEEDED_MESSAGES.en[feature];
  }

  /**
   * Check if user can use a feature (before executing)
   * Returns { allowed: true } or { allowed: false, message: string }
   */
  async checkFeatureLimit(
    userId: string,
    feature: LimitedFeature,
    language: string = "en",
    count: number = 1
  ): Promise<{ allowed: boolean; message?: string; remaining?: number }> {
    const plan = await this.getUserPlan(userId);
    const limits = this.getPlanLimits(plan);
    const usage = await this.getOrCreateUsageRecord(userId);

    // Get limit for this feature
    const featureLimitMap: Record<LimitedFeature, number> = {
      summaries: limits.summaries,
      flashcards: limits.flashcards,
      quizzes: limits.quizzes,
      assistantMessages: limits.assistantMessages,
    };

    const limit = featureLimitMap[feature];
    
    // Check if feature is available (limit > 0)
    if (limit === 0) {
      return {
        allowed: false,
        message: this.getErrorMessage("featureNotAvailable", language),
        remaining: 0,
      };
    }

    // Get current usage for this feature
    const usageMap: Record<LimitedFeature, number> = {
      summaries: usage.summariesGenerated,
      flashcards: usage.flashcardsGenerated,
      quizzes: usage.quizzesGenerated,
      assistantMessages: usage.chatMessagesCount,
    };

    const currentUsage = usageMap[feature];
    const remaining = limit - currentUsage;

    // Premium plan has soft limits for flashcards (fair use)
    if (plan === "premium" && feature === "flashcards") {
      // Allow slight overflow for premium (10% buffer)
      const softLimit = Math.floor(limit * 1.1);
      if (currentUsage + count > softLimit) {
        return {
          allowed: false,
          message: this.getErrorMessage(feature, language),
          remaining: Math.max(0, softLimit - currentUsage),
        };
      }
      return { allowed: true, remaining: Math.max(0, softLimit - currentUsage - count) };
    }

    // Check if limit would be exceeded
    if (currentUsage + count > limit) {
      return {
        allowed: false,
        message: this.getErrorMessage(feature, language),
        remaining: Math.max(0, remaining),
      };
    }

    return { allowed: true, remaining: remaining - count };
  }

  /**
   * Check internal token budget (invisible to users)
   */
  async checkTokenBudget(
    userId: string,
    estimatedTokens: number,
    language: string = "en"
  ): Promise<{ allowed: boolean; message?: string }> {
    const plan = await this.getUserPlan(userId);
    const limits = this.getPlanLimits(plan);
    const usage = await this.getOrCreateUsageRecord(userId);

    // Premium has fair-use policy - allow slight overflow
    const buffer = plan === "premium" ? 1.1 : 1.0;
    const effectiveLimit = Math.floor(limits.tokenBudget * buffer);

    if (usage.tokensUsed + estimatedTokens > effectiveLimit) {
      return {
        allowed: false,
        message: this.getErrorMessage("tokens", language),
      };
    }

    return { allowed: true };
  }

  /**
   * Record feature usage after successful execution
   */
  async recordUsage(
    userId: string,
    feature: LimitedFeature,
    count: number = 1,
    tokensUsed: number = 0
  ): Promise<void> {
    const currentMonth = this.getCurrentMonth();
    
    // Get current usage record
    const usage = await this.getOrCreateUsageRecord(userId);

    // Calculate new values
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    switch (feature) {
      case "summaries":
        updateData.summariesGenerated = usage.summariesGenerated + count;
        break;
      case "flashcards":
        updateData.flashcardsGenerated = usage.flashcardsGenerated + count;
        break;
      case "quizzes":
        updateData.quizzesGenerated = usage.quizzesGenerated + count;
        break;
      case "assistantMessages":
        updateData.chatMessagesCount = usage.chatMessagesCount + count;
        break;
    }

    // Always add token usage if provided
    if (tokensUsed > 0) {
      updateData.tokensUsed = usage.tokensUsed + tokensUsed;
    }

    await db
      .update(usageTracking)
      .set(updateData)
      .where(and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.month, currentMonth)
      ));
  }

  /**
   * Record only token usage (for operations that don't have feature limits)
   */
  async recordTokenUsage(userId: string, tokensUsed: number): Promise<void> {
    const currentMonth = this.getCurrentMonth();
    
    // Get current usage record
    const usage = await this.getOrCreateUsageRecord(userId);

    await db
      .update(usageTracking)
      .set({
        tokensUsed: usage.tokensUsed + tokensUsed,
        updatedAt: new Date(),
      })
      .where(and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.month, currentMonth)
      ));
  }

  /**
   * Get current usage statistics for a user (for display purposes)
   */
  async getUsageStats(userId: string): Promise<{
    plan: SubscriptionPlan;
    limits: typeof monthlyUsageLimits.free;
    usage: {
      summaries: number;
      flashcards: number;
      quizzes: number;
      assistantMessages: number;
    };
    month: string;
  }> {
    const plan = await this.getUserPlan(userId);
    const limits = this.getPlanLimits(plan);
    const usage = await this.getOrCreateUsageRecord(userId);

    return {
      plan,
      limits,
      usage: {
        summaries: usage.summariesGenerated,
        flashcards: usage.flashcardsGenerated,
        quizzes: usage.quizzesGenerated,
        assistantMessages: usage.chatMessagesCount,
      },
      month: usage.month,
    };
  }
}

export const usageLimitsService = new UsageLimitsService();
