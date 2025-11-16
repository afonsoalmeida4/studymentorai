import type { Express} from "express";
import { z } from "zod";
import { isAuthenticated } from "./replitAuth";
import {
  createChatThread,
  getChatHistory,
  sendMessage,
  getUserThreads,
  deleteThread,
} from "./assistentService";
import { chatModes } from "@shared/schema";
import { subscriptionService } from "./subscriptionService";

export function registerChatRoutes(app: Express) {
  app.post("/api/chat/threads", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/chat/threads", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/chat/threads/:threadId", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
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

      const response = await sendMessage({
        threadId,
        userId,
        userMessage: message,
      });

      await subscriptionService.incrementChatMessageCount(userId);

      res.json({ success: true, ...response });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ success: false, error: "Erro ao enviar mensagem" });
    }
  });

  app.delete("/api/chat/threads/:threadId", isAuthenticated, async (req: any, res) => {
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
