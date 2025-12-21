import type { Express} from "express";
import { z } from "zod";
import { isAuthenticated } from "./replitAuth";
import {
  createChatThread,
  getChatHistory,
  sendMessage,
  getUserThreads,
  deleteThread,
  updateChatThreadTitle,
} from "./assistentService";
import { chatModes } from "@shared/schema";
import { subscriptionService } from "./subscriptionService";
import { getUserLanguage } from "./languageHelper";
import { usageLimitsService } from "./usageLimitsService";

// Middleware to require Premium subscription for AI Mentor access
async function requirePremium(req: any, res: any, next: any) {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }
    
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (subscription.plan !== "premium") {
      return res.status(403).json({ 
        success: false, 
        error: "AI Mentor está disponível apenas no plano Premium.",
        upgradeRequired: true 
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking premium status:", error);
    return res.status(500).json({ success: false, error: "Erro ao verificar subscrição" });
  }
}

export function registerChatRoutes(app: Express) {
  app.post("/api/chat/threads", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode, topicId, title } = req.body;

      const modeSchema = z.enum(chatModes);
      const validMode = modeSchema.parse(mode || "study");

      if (validMode === "existential") {
        const subscription = await subscriptionService.getOrCreateSubscription(userId);
        const limits = subscriptionService.getPlanLimits(subscription.plan);
        
        if (!limits.chatModes.includes(validMode)) {
          return res.status(403).json({
            success: false,
            error: "O Modo Existencial está disponível apenas nos planos Pro e superiores.",
            upgradeRequired: true,
          });
        }
      }

      const thread = await createChatThread({
        userId,
        mode: validMode,
        topicId: topicId || undefined,
        title,
      });

      res.json({ success: true, thread });
    } catch (error) {
      console.error("Error creating chat thread:", error);
      res.status(400).json({ success: false, error: "Erro ao criar conversa" });
    }
  });

  app.get("/api/chat/threads", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode } = req.query;

      const validMode = mode ? z.enum(chatModes).parse(mode) : undefined;

      const threads = await getUserThreads(userId, validMode);

      res.json({ success: true, threads });
    } catch (error) {
      console.error("Error fetching chat threads:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar conversas" });
    }
  });

  app.get("/api/chat/threads/:threadId", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { threadId } = req.params;

      const { thread, messages } = await getChatHistory(threadId, userId);

      res.json({ success: true, thread, messages });
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(404).json({ success: false, error: "Conversa não encontrada" });
    }
  });

  app.post("/api/chat/messages", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { threadId, message } = req.body;

      if (!threadId || !message) {
        return res.status(400).json({ success: false, error: "threadId e message são obrigatórios" });
      }

      const { thread } = await getChatHistory(threadId, userId);
      
      const modeSchema = z.enum(chatModes);
      const validatedMode = modeSchema.parse(thread.mode);
      
      const chatCheck = await subscriptionService.canSendChatMessage(userId, validatedMode);
      if (!chatCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: chatCheck.reason,
          upgradeRequired: true,
        });
      }

      // Fetch user language preference with robust fallback
      const { storage } = await import("./storage");
      const user = await storage.getUser(userId);
      const userLanguage = getUserLanguage(user?.language);

      // Check monthly usage limit for assistant messages
      const messageLimitCheck = await usageLimitsService.checkFeatureLimit(userId, "assistantMessages", userLanguage);
      if (!messageLimitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: messageLimitCheck.message,
          upgradeRequired: true,
        });
      }

      const response = await sendMessage({
        threadId,
        userId,
        userMessage: message,
        language: userLanguage,
      });

      // Record monthly usage for assistant messages
      await usageLimitsService.recordUsage(userId, "assistantMessages", 1);
      
      await subscriptionService.incrementChatMessageCount(userId);

      res.json({ success: true, ...response });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ success: false, error: "Erro ao enviar mensagem" });
    }
  });

  app.patch("/api/chat/threads/:threadId", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { threadId } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ success: false, error: "Título é obrigatório" });
      }

      const thread = await updateChatThreadTitle(threadId, userId, title.trim());

      res.json({ success: true, thread });
    } catch (error) {
      console.error("Error updating thread title:", error);
      res.status(404).json({ success: false, error: "Conversa não encontrada" });
    }
  });

  app.delete("/api/chat/threads/:threadId", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { threadId } = req.params;

      await deleteThread(threadId, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting thread:", error);
      res.status(404).json({ success: false, error: "Conversa não encontrada" });
    }
  });
}
