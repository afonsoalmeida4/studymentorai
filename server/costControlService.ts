/**
 * Invisible Cost Control Service
 * 
 * Controls AI costs silently based on subscription plan.
 * Users never see limits, tokens, credits, or quotas.
 * Experience feels "unlimited" - only output depth varies.
 * 
 * CORE PRINCIPLE: Users should never "hit a limit".
 * They receive DIFFERENT OUTPUT DEPTH based on their plan.
 */

import { subscriptionService } from "./subscriptionService";

// Plan tiers mapped to internal names
type PlanTier = "free" | "pro" | "premium";

/**
 * Plan-specific limits - NEVER exposed to users
 */
interface PlanLimits {
  // Input size control (characters)
  maxInputChars: number;
  
  // File size control (bytes)
  maxFileSize: number;
  
  // Chat context window (number of previous messages)
  maxChatContextMessages: number;
  
  // Chat topic context (characters from topic materials)
  maxTopicContextChars: number;
  
  // Daily processing limits (soft - delays rather than blocks)
  dailySummaryLimit: number;
  dailyFlashcardBatchLimit: number;
  dailyChatMessageLimit: number;
  
  // Summary depth configuration
  summaryDepth: "concise" | "structured" | "deep";
  
  // Flashcard generation
  maxFlashcardsPerBatch: number | null; // null = unlimited
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxInputChars: 15000,          // ~3750 tokens, process partial content
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxChatContextMessages: 10,     // Limited history
    maxTopicContextChars: 2000,     // Minimal topic context
    dailySummaryLimit: 20,          // Soft limit
    dailyFlashcardBatchLimit: 10,   // Soft limit
    dailyChatMessageLimit: 50,      // Soft limit
    summaryDepth: "concise",
    maxFlashcardsPerBatch: 10,
  },
  pro: {
    maxInputChars: 50000,           // ~12500 tokens, full content
    maxFileSize: 25 * 1024 * 1024,  // 25MB
    maxChatContextMessages: 30,      // Good history
    maxTopicContextChars: 5000,      // Rich topic context
    dailySummaryLimit: 100,          // Generous soft limit
    dailyFlashcardBatchLimit: 50,    // Generous soft limit
    dailyChatMessageLimit: 200,      // Generous soft limit
    summaryDepth: "structured",
    maxFlashcardsPerBatch: null,     // Unlimited
  },
  premium: {
    maxInputChars: 100000,           // ~25000 tokens, full content + more
    maxFileSize: 50 * 1024 * 1024,   // 50MB
    maxChatContextMessages: 50,       // Full history
    maxTopicContextChars: 8000,       // Maximum topic context
    dailySummaryLimit: 500,           // Very generous
    dailyFlashcardBatchLimit: 200,    // Very generous
    dailyChatMessageLimit: 1000,      // Very generous
    summaryDepth: "deep",
    maxFlashcardsPerBatch: null,      // Unlimited
  },
};

/**
 * Summary depth prompts per plan - appended to existing learning style prompts
 */
const SUMMARY_DEPTH_MODIFIERS: Record<PlanLimits["summaryDepth"], Record<string, string>> = {
  concise: {
    pt: "\n\nMANTÉM O RESUMO CONCISO: Foca apenas nas ideias principais e conceitos essenciais. Máximo 500 palavras.",
    en: "\n\nKEEP THE SUMMARY CONCISE: Focus only on main ideas and essential concepts. Maximum 500 words.",
    es: "\n\nMANTÉN EL RESUMEN CONCISO: Enfócate solo en las ideas principales y conceptos esenciales. Máximo 500 palabras.",
    fr: "\n\nGARDEZ LE RÉSUMÉ CONCIS: Concentrez-vous uniquement sur les idées principales et les concepts essentiels. Maximum 500 mots.",
    de: "\n\nHALTEN SIE DIE ZUSAMMENFASSUNG KURZ: Konzentrieren Sie sich nur auf Hauptideen und wesentliche Konzepte. Maximal 500 Wörter.",
    it: "\n\nMANTIENI IL RIASSUNTO CONCISO: Concentrati solo sulle idee principali e i concetti essenziali. Massimo 500 parole.",
  },
  structured: {
    pt: "\n\nCRIA UM RESUMO ESTRUTURADO: Organiza com títulos e bullet points. Inclui definições importantes e exemplos breves. Extensão média detalhada.",
    en: "\n\nCREATE A STRUCTURED SUMMARY: Organize with headings and bullet points. Include important definitions and brief examples. Medium detailed length.",
    es: "\n\nCREA UN RESUMEN ESTRUCTURADO: Organiza con títulos y puntos. Incluye definiciones importantes y ejemplos breves. Extensión media detallada.",
    fr: "\n\nCRÉEZ UN RÉSUMÉ STRUCTURÉ: Organisez avec des titres et des points. Incluez des définitions importantes et des exemples brefs. Longueur moyenne détaillée.",
    de: "\n\nERSTELLEN SIE EINE STRUKTURIERTE ZUSAMMENFASSUNG: Organisieren Sie mit Überschriften und Aufzählungspunkten. Fügen Sie wichtige Definitionen und kurze Beispiele hinzu. Mittlere detaillierte Länge.",
    it: "\n\nCREA UN RIASSUNTO STRUTTURATO: Organizza con titoli e punti elenco. Includi definizioni importanti ed esempi brevi. Lunghezza media dettagliata.",
  },
  deep: {
    pt: "\n\nCRIA UM RESUMO APROFUNDADO PARA EXAME: Explicações detalhadas e completas. Estabelece relações entre conceitos. Inclui exemplos práticos e aplicados. Destaca nuances e exceções. Prepara para questões de exame avançadas.",
    en: "\n\nCREATE AN EXAM-READY DEEP SUMMARY: Detailed and complete explanations. Establish relationships between concepts. Include practical and applied examples. Highlight nuances and exceptions. Prepare for advanced exam questions.",
    es: "\n\nCREA UN RESUMEN PROFUNDO PARA EXAMEN: Explicaciones detalladas y completas. Establece relaciones entre conceptos. Incluye ejemplos prácticos y aplicados. Destaca matices y excepciones. Prepara para preguntas de examen avanzadas.",
    fr: "\n\nCRÉEZ UN RÉSUMÉ APPROFONDI POUR L'EXAMEN: Explications détaillées et complètes. Établissez des relations entre les concepts. Incluez des exemples pratiques et appliqués. Mettez en évidence les nuances et les exceptions. Préparez les questions d'examen avancées.",
    de: "\n\nERSTELLEN SIE EINE TIEFGEHENDE PRÜFUNGSZUSAMMENFASSUNG: Detaillierte und vollständige Erklärungen. Stellen Sie Beziehungen zwischen Konzepten her. Fügen Sie praktische und angewandte Beispiele hinzu. Heben Sie Nuancen und Ausnahmen hervor. Bereiten Sie sich auf fortgeschrittene Prüfungsfragen vor.",
    it: "\n\nCREA UN RIASSUNTO APPROFONDITO PER ESAME: Spiegazioni dettagliate e complete. Stabilisci relazioni tra concetti. Includi esempi pratici e applicati. Evidenzia sfumature ed eccezioni. Prepara per domande d'esame avanzate.",
  },
};

/**
 * Chat context depth modifiers - appended to system prompts
 */
const CHAT_DEPTH_MODIFIERS: Record<PlanLimits["summaryDepth"], Record<string, string>> = {
  concise: {
    pt: " Dá respostas diretas e concisas.",
    en: " Give direct and concise answers.",
    es: " Da respuestas directas y concisas.",
    fr: " Donnez des réponses directes et concises.",
    de: " Geben Sie direkte und präzise Antworten.",
    it: " Dai risposte dirette e concise.",
  },
  structured: {
    pt: " Estrutura as respostas com clareza. Usa exemplos quando apropriado.",
    en: " Structure answers clearly. Use examples when appropriate.",
    es: " Estructura las respuestas con claridad. Usa ejemplos cuando sea apropiado.",
    fr: " Structurez les réponses clairement. Utilisez des exemples le cas échéant.",
    de: " Strukturieren Sie Antworten klar. Verwenden Sie Beispiele, wenn angemessen.",
    it: " Struttura le risposte con chiarezza. Usa esempi quando appropriato.",
  },
  deep: {
    pt: " Fornece explicações aprofundadas e detalhadas. Estabelece conexões entre conceitos. Inclui exemplos práticos e casos de uso reais.",
    en: " Provide in-depth and detailed explanations. Establish connections between concepts. Include practical examples and real use cases.",
    es: " Proporciona explicaciones profundas y detalladas. Establece conexiones entre conceptos. Incluye ejemplos prácticos y casos de uso reales.",
    fr: " Fournissez des explications approfondies et détaillées. Établissez des connexions entre les concepts. Incluez des exemples pratiques et des cas d'utilisation réels.",
    de: " Bieten Sie ausführliche und detaillierte Erklärungen. Stellen Sie Verbindungen zwischen Konzepten her. Fügen Sie praktische Beispiele und reale Anwendungsfälle hinzu.",
    it: " Fornisci spiegazioni approfondite e dettagliate. Stabilisci connessioni tra concetti. Includi esempi pratici e casi d'uso reali.",
  },
};

/**
 * In-memory daily usage tracking (would be replaced with Redis in production)
 * Key format: "userId:date:type"
 */
const dailyUsageCache = new Map<string, number>();

class CostControlService {
  
  /**
   * Get the plan tier for a user
   */
  async getUserPlanTier(userId: string): Promise<PlanTier> {
    try {
      const { subscription } = await subscriptionService.getSubscriptionDetails(userId);
      const plan = subscription.plan.toLowerCase();
      
      if (plan === "premium" || plan === "educational" || plan === "educational_student") {
        return "premium";
      } else if (plan === "pro") {
        return "pro";
      }
      return "free";
    } catch (error) {
      console.error("[CostControl] Error getting plan tier:", error);
      return "free";
    }
  }
  
  /**
   * Get limits for a plan
   */
  getPlanLimits(tier: PlanTier): PlanLimits {
    return PLAN_LIMITS[tier];
  }
  
  /**
   * Silently trim input text based on plan limits
   * Never notifies the user about trimming
   */
  trimInputText(text: string, tier: PlanTier): string {
    const limits = PLAN_LIMITS[tier];
    
    if (text.length <= limits.maxInputChars) {
      return text;
    }
    
    // Silent trimming - no user-visible logging
    
    // Intelligent trimming: try to keep complete paragraphs/sections
    const trimmed = text.substring(0, limits.maxInputChars);
    
    // Find the last paragraph break to avoid cutting mid-sentence
    const lastParagraph = trimmed.lastIndexOf("\n\n");
    if (lastParagraph > limits.maxInputChars * 0.7) {
      return trimmed.substring(0, lastParagraph);
    }
    
    // Fall back to last sentence
    const lastSentence = Math.max(
      trimmed.lastIndexOf(". "),
      trimmed.lastIndexOf("! "),
      trimmed.lastIndexOf("? ")
    );
    
    if (lastSentence > limits.maxInputChars * 0.8) {
      return trimmed.substring(0, lastSentence + 1);
    }
    
    return trimmed;
  }
  
  /**
   * Check if file size is within plan limits
   * Returns processed size (could be original or chunked)
   */
  validateFileSize(fileSize: number, tier: PlanTier): { allowed: boolean; processedSize: number } {
    const limits = PLAN_LIMITS[tier];
    
    if (fileSize <= limits.maxFileSize) {
      return { allowed: true, processedSize: fileSize };
    }
    
    // For files exceeding limit, we'll process only the allowed portion silently
    
    return { 
      allowed: true, // Never block, just process partially
      processedSize: limits.maxFileSize 
    };
  }
  
  /**
   * Get the summary depth modifier to append to prompts
   */
  getSummaryDepthModifier(tier: PlanTier, language: string): string {
    const limits = PLAN_LIMITS[tier];
    const modifiers = SUMMARY_DEPTH_MODIFIERS[limits.summaryDepth];
    return modifiers[language] || modifiers["pt"];
  }
  
  /**
   * Get the chat depth modifier to append to system prompts
   */
  getChatDepthModifier(tier: PlanTier, language: string): string {
    const limits = PLAN_LIMITS[tier];
    const modifiers = CHAT_DEPTH_MODIFIERS[limits.summaryDepth];
    return modifiers[language] || modifiers["pt"];
  }
  
  /**
   * Limit chat context messages based on plan
   */
  limitChatContext<T>(messages: T[], tier: PlanTier): T[] {
    const limits = PLAN_LIMITS[tier];
    
    if (messages.length <= limits.maxChatContextMessages) {
      return messages;
    }
    
    // Silent context limiting - no user-visible logging
    
    // Keep the most recent messages
    return messages.slice(-limits.maxChatContextMessages);
  }
  
  /**
   * Limit topic context for chat based on plan
   */
  limitTopicContext(context: string, tier: PlanTier): string {
    const limits = PLAN_LIMITS[tier];
    
    if (context.length <= limits.maxTopicContextChars) {
      return context;
    }
    
    // Silent topic context limiting - no user-visible logging
    
    // Trim to limit, trying to keep complete sections
    const trimmed = context.substring(0, limits.maxTopicContextChars);
    const lastNewline = trimmed.lastIndexOf("\n");
    
    if (lastNewline > limits.maxTopicContextChars * 0.7) {
      return trimmed.substring(0, lastNewline);
    }
    
    return trimmed;
  }
  
  /**
   * Get max completion tokens based on plan (for OpenAI API)
   */
  getMaxCompletionTokens(tier: PlanTier, operation: "summary" | "flashcard" | "chat"): number {
    const baseTokens = {
      summary: { free: 2048, pro: 4096, premium: 8192 },
      flashcard: { free: 2048, pro: 4096, premium: 6144 },
      chat: { free: 500, pro: 800, premium: 1200 },
    };
    
    return baseTokens[operation][tier];
  }
  
  /**
   * Check and track daily usage (soft limit with delays, never blocks)
   */
  async checkDailyUsage(
    userId: string, 
    type: "summary" | "flashcard" | "chat",
    tier: PlanTier
  ): Promise<{ allowed: boolean; shouldDelay: boolean; delayMs: number }> {
    const today = new Date().toISOString().split("T")[0];
    const key = `${userId}:${today}:${type}`;
    
    const currentCount = dailyUsageCache.get(key) || 0;
    const limits = PLAN_LIMITS[tier];
    
    let limit: number;
    switch (type) {
      case "summary":
        limit = limits.dailySummaryLimit;
        break;
      case "flashcard":
        limit = limits.dailyFlashcardBatchLimit;
        break;
      case "chat":
        limit = limits.dailyChatMessageLimit;
        break;
    }
    
    // Never block, just add slight delays for abuse protection
    if (currentCount >= limit * 2) {
      // Heavy abuse - add significant delay silently
      return { allowed: true, shouldDelay: true, delayMs: 3000 };
    } else if (currentCount >= limit) {
      // Over soft limit - add small delay silently
      return { allowed: true, shouldDelay: true, delayMs: 1000 };
    }
    
    return { allowed: true, shouldDelay: false, delayMs: 0 };
  }
  
  /**
   * Increment daily usage counter
   */
  incrementDailyUsage(userId: string, type: "summary" | "flashcard" | "chat"): void {
    const today = new Date().toISOString().split("T")[0];
    const key = `${userId}:${today}:${type}`;
    
    const currentCount = dailyUsageCache.get(key) || 0;
    dailyUsageCache.set(key, currentCount + 1);
  }
  
  /**
   * Get max flashcards per batch based on plan
   */
  getMaxFlashcardsPerBatch(tier: PlanTier): number | null {
    return PLAN_LIMITS[tier].maxFlashcardsPerBatch;
  }
  
  /**
   * Apply a soft delay if needed (for abuse protection)
   */
  async applyDelayIfNeeded(delayMs: number): Promise<void> {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  /**
   * Clean up old daily usage entries (call periodically)
   */
  cleanupDailyUsageCache(): void {
    const today = new Date().toISOString().split("T")[0];
    const keys = Array.from(dailyUsageCache.keys());
    
    for (const key of keys) {
      const keyDate = key.split(":")[1];
      if (keyDate !== today) {
        dailyUsageCache.delete(key);
      }
    }
  }
}

export const costControlService = new CostControlService();
