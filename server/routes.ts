import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Stripe from "stripe";
import { generateSummary, generateFlashcards, generateReviewPlan, type StudyHistoryItem } from "./openai";
import { 
  generateSummaryRequestSchema, 
  generateFlashcardsRequestSchema,
  recordStudySessionRequestSchema,
  recordAttemptSchema,
  type GenerateSummaryResponse,
  type GenerateFlashcardsResponse,
  type RecordStudySessionResponse,
  type GetDashboardStatsResponse,
  type GetReviewPlanResponse,
  flashcards,
  flashcardAttempts,
} from "@shared/schema";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { awardXP, getGamificationProfile, getLeaderboard, activatePremium } from "./gamificationService";
import { registerOrganizationRoutes } from "./organizationRoutes";
import { registerChatRoutes } from "./chatRoutes";
import { calculateNextReview } from "./flashcardScheduler";
import { db } from "./db";
import { and, eq, sql, gt, asc } from "drizzle-orm";
import * as classService from "./classService";
import { insertClassSchema, insertClassEnrollmentSchema } from "@shared/schema";
import { subscriptionService } from "./subscriptionService";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Configure multer for file upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas ficheiros PDF são permitidos"));
    }
  },
});

// Helper to resolve flashcard context (summaryId OR topicSummaryId)
type FlashcardContext = 
  | { type: "summary"; id: string }
  | { type: "topicSummary"; id: string };

async function resolveFlashcardContext(
  id: string,
  userId: string
): Promise<FlashcardContext | null> {
  // Try topic summary first (newer system)
  const topicSummary = await storage.getTopicSummary(id, userId);
  if (topicSummary) {
    return { type: "topicSummary", id };
  }

  // Try legacy summary
  const summary = await storage.getSummary(id);
  if (summary && summary.userId === userId) {
    return { type: "summary", id };
  }

  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      // If user doesn't exist in database, create from claims
      if (!user) {
        const claims = req.user.claims;
        user = await storage.upsertUser({
          id: claims.sub,
          email: claims.email,
          firstName: claims.first_name,
          lastName: claims.last_name,
          profileImageUrl: claims.profile_image_url,
        });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // PDF Upload and Summary Generation Endpoint (Protected)
  app.post("/api/generate-summary", isAuthenticated, upload.single("pdf"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check subscription limits for uploads
      const uploadCheck = await subscriptionService.canUpload(userId);
      if (!uploadCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: uploadCheck.reason,
          upgradeRequired: true,
        } as GenerateSummaryResponse);
      }

      // Validate file upload
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Nenhum ficheiro PDF foi carregado",
        } as GenerateSummaryResponse);
      }

      // Validate learning style
      const parseResult = generateSummaryRequestSchema.safeParse({
        learningStyle: req.body.learningStyle,
      });

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Estilo de aprendizagem inválido",
        } as GenerateSummaryResponse);
      }

      const { learningStyle } = parseResult.data;

      // Extract text from PDF
      let pdfText: string;
      try {
        // Import pdf-parse and use the PDFParse class
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: req.file.buffer });
        const pdfData = await parser.getText();
        pdfText = pdfData.text;

        if (!pdfText || pdfText.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: "O PDF não contém texto extraível",
          } as GenerateSummaryResponse);
        }

        // Limit text length to avoid token limits
        // Reduce to 1500 words (~2000 tokens) to leave room for system prompt + response
        const words = pdfText.split(/\s+/);
        console.log(`[PDF Processing] Original word count: ${words.length}`);
        if (words.length > 1500) {
          pdfText = words.slice(0, 1500).join(" ");
          console.log(`[PDF Processing] Truncated to 1500 words`);
        }
        console.log(`[PDF Processing] Final text length: ${pdfText.length} characters, ~${Math.ceil(pdfText.length / 4)} estimated tokens`);
      } catch (error) {
        console.error("Error extracting PDF text:", error);
        return res.status(400).json({
          success: false,
          error: "Erro ao extrair texto do PDF. Verifique se o ficheiro não está corrompido.",
        } as GenerateSummaryResponse);
      }

      // Generate summary using GPT-5
      try {
        const { summary, motivationalMessage } = await generateSummary({
          text: pdfText,
          learningStyle,
        });

        // Check summary word count against plan limits
        const summaryWordCount = summary.split(/\s+/).length;
        const summaryCheck = await subscriptionService.canGenerateSummary(userId, summaryWordCount);
        if (!summaryCheck.allowed) {
          return res.status(403).json({
            success: false,
            error: summaryCheck.reason,
            upgradeRequired: true,
          } as GenerateSummaryResponse);
        }

        // Save to database
        const savedSummary = await storage.createSummary({
          userId,
          fileName: req.file.originalname,
          learningStyle,
          summary,
          motivationalMessage,
          isFavorite: false,
        });

        // Increment usage counters
        await Promise.all([
          subscriptionService.incrementUploadCount(userId),
          subscriptionService.incrementSummaryCount(userId),
        ]);

        // Award XP for generating summary
        await awardXP(userId, "generate_summary", { 
          fileName: req.file.originalname,
          learningStyle,
        });

        return res.json({
          success: true,
          summary: {
            ...savedSummary,
            createdAt: savedSummary.createdAt?.toISOString() || new Date().toISOString(),
          },
        } as GenerateSummaryResponse);
      } catch (error) {
        console.error("Error generating summary:", error);
        return res.status(500).json({
          success: false,
          error: "Erro ao gerar resumo com IA. Por favor, tente novamente.",
        } as GenerateSummaryResponse);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.status(500).json({
        success: false,
        error: "Erro inesperado no servidor",
      } as GenerateSummaryResponse);
    }
  });

  // Get user's summary history
  app.get("/api/summaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaries = await storage.getUserSummaries(userId);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ error: "Failed to fetch summaries" });
    }
  });

  // Toggle favorite
  app.patch("/api/summaries/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.id;
      
      const updated = await storage.toggleFavorite(summaryId, userId);
      if (!updated) {
        return res.status(404).json({ error: "Summary not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  });

  // Delete summary
  app.delete("/api/summaries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.id;
      
      const success = await storage.deleteSummary(summaryId, userId);
      if (!success) {
        return res.status(404).json({ error: "Summary not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting summary:", error);
      res.status(500).json({ error: "Failed to delete summary" });
    }
  });

  // Generate flashcards from a summary (or topic summary)
  app.post("/api/flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const { summaryId, topicSummaryId } = req.body;
      
      console.log("[Flashcards] Request body:", { summaryId, topicSummaryId, userId });
      
      if (!summaryId && !topicSummaryId) {
        return res.status(400).json({
          success: false,
          error: "summaryId ou topicSummaryId é obrigatório",
        } as GenerateFlashcardsResponse);
      }

      if (summaryId && topicSummaryId) {
        return res.status(400).json({
          success: false,
          error: "Apenas um de summaryId ou topicSummaryId pode ser fornecido",
        } as GenerateFlashcardsResponse);
      }

      let summaryText: string;
      let flashcardsQuery: any;

      if (topicSummaryId) {
        console.log("[Flashcards] Looking for topicSummaryId:", topicSummaryId);
        const topicSummary = await storage.getTopicSummary(topicSummaryId, userId);
        console.log("[Flashcards] Found topicSummary:", topicSummary ? "yes" : "no");
        if (!topicSummary) {
          return res.status(404).json({
            success: false,
            error: "Resumo do tópico não encontrado",
          } as GenerateFlashcardsResponse);
        }

        const existingFlashcards = await storage.getFlashcardsByTopicSummary(topicSummaryId);
        if (existingFlashcards.length > 0) {
          return res.json({
            success: true,
            flashcards: existingFlashcards.map(fc => ({
              ...fc,
              createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
            })),
          } as GenerateFlashcardsResponse);
        }

        summaryText = topicSummary.summary;
        flashcardsQuery = (flashcardsData: any[]) => flashcardsData.map((fc: any) => ({
          topicSummaryId,
          question: fc.question,
          answer: fc.answer,
        }));
      } else {
        const summary = await storage.getSummary(summaryId);
        if (!summary || summary.userId !== userId) {
          return res.status(404).json({
            success: false,
            error: "Resumo não encontrado",
          } as GenerateFlashcardsResponse);
        }

        const existingFlashcards = await storage.getFlashcardsBySummary(summaryId);
        if (existingFlashcards.length > 0) {
          return res.json({
            success: true,
            flashcards: existingFlashcards.map(fc => ({
              ...fc,
              createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
            })),
          } as GenerateFlashcardsResponse);
        }

        summaryText = summary.summary;
        flashcardsQuery = (flashcardsData: any[]) => flashcardsData.map((fc: any) => ({
          summaryId,
          question: fc.question,
          answer: fc.answer,
        }));
      }

      const flashcardsData = await generateFlashcards(summaryText);
      const savedFlashcards = await storage.createFlashcards(flashcardsQuery(flashcardsData));

      await awardXP(userId, "create_flashcards", { 
        summaryId: summaryId || topicSummaryId,
        flashcardCount: savedFlashcards.length,
      });

      return res.json({
        success: true,
        flashcards: savedFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
      } as GenerateFlashcardsResponse);
    } catch (error) {
      console.error("Error generating flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao gerar flashcards. Por favor, tente novamente.",
      } as GenerateFlashcardsResponse);
    }
  });

  // Get flashcards for a summary
  app.get("/api/flashcards/:summaryId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.summaryId;

      // Verify summary exists and belongs to user
      const summary = await storage.getSummary(summaryId);
      if (!summary || summary.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        } as GenerateFlashcardsResponse);
      }

      const flashcards = await storage.getFlashcardsBySummary(summaryId);
      
      return res.json({
        success: true,
        flashcards: flashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
      } as GenerateFlashcardsResponse);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards",
      } as GenerateFlashcardsResponse);
    }
  });

  // Get due flashcards for review (Anki-style)
  app.get("/api/flashcards/:summaryId/due", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.summaryId;

      // Resolve context (supports both summaryId and topicSummaryId)
      const context = await resolveFlashcardContext(summaryId, userId);
      if (!context) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        });
      }

      const dueFlashcards = await storage.getDueFlashcards(userId, summaryId);
      
      // Buscar o próximo flashcard disponível (query customizada)
      const now = new Date();
      const upcomingQuery = await db
        .select({
          nextReviewDate: flashcardAttempts.nextReviewDate,
        })
        .from(flashcards)
        .innerJoin(
          flashcardAttempts,
          and(
            eq(flashcards.id, flashcardAttempts.flashcardId),
            eq(flashcardAttempts.userId, userId)
          )
        )
        .where(
          and(
            sql`(${flashcards.summaryId} = ${summaryId} OR ${flashcards.topicSummaryId} = ${summaryId})`,
            gt(flashcardAttempts.nextReviewDate, now)
          )
        )
        .orderBy(asc(flashcardAttempts.nextReviewDate))
        .limit(1);
      
      const nextAvailableAt = upcomingQuery.length > 0 
        ? upcomingQuery[0].nextReviewDate 
        : null;
      
      return res.json({
        success: true,
        flashcards: dueFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
        nextAvailableAt: nextAvailableAt?.toISOString() || null,
      });
    } catch (error) {
      console.error("Error fetching due flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards para revisão",
      });
    }
  });

  // Get ALL flashcards (for practice mode - ignores schedule)
  app.get("/api/flashcards/:summaryId/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.summaryId;

      // Resolve context (supports both summaryId and topicSummaryId)
      const context = await resolveFlashcardContext(summaryId, userId);
      if (!context) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        });
      }

      // Fetch all flashcards regardless of schedule
      let allFlashcards;
      if (context.type === "topicSummary") {
        allFlashcards = await storage.getFlashcardsByTopicSummary(summaryId);
      } else {
        allFlashcards = await storage.getFlashcardsBySummary(summaryId);
      }
      
      return res.json({
        success: true,
        flashcards: allFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching all flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards",
      });
    }
  });

  // Record flashcard attempt (Anki-style rating)
  app.post("/api/flashcards/:flashcardId/attempt", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flashcardId = req.params.flashcardId;

      // Validate request body
      const parseResult = recordAttemptSchema.safeParse({ ...req.body, flashcardId });
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Rating inválido (deve ser 1-4)",
        });
      }

      const { rating } = parseResult.data;

      // Verify flashcard exists
      const flashcard = await storage.getFlashcard(flashcardId);
      if (!flashcard) {
        return res.status(404).json({
          success: false,
          error: "Flashcard não encontrado",
        });
      }

      // Verify user owns the summary containing this flashcard
      if (flashcard.summaryId) {
        const summary = await storage.getSummary(flashcard.summaryId);
        if (!summary || summary.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: "Sem permissão",
          });
        }
      } else if (flashcard.topicSummaryId) {
        const topicSummary = await storage.getTopicSummary(flashcard.topicSummaryId, userId);
        if (!topicSummary) {
          return res.status(403).json({
            success: false,
            error: "Sem permissão",
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          error: "Flashcard sem referência de resumo",
        });
      }

      // Get latest attempt for this flashcard
      const latestAttempt = await storage.getLatestAttempt(userId, flashcardId);

      // Calculate next review using SM-2 algorithm
      const scheduling = calculateNextReview(rating, latestAttempt);

      // Save attempt
      await storage.createFlashcardAttempt({
        userId,
        flashcardId,
        rating,
        attemptDate: new Date(),
        nextReviewDate: scheduling.nextReviewDate,
        easeFactor: scheduling.easeFactor,
        intervalDays: scheduling.intervalDays,
        repetitions: scheduling.repetitions,
      });

      return res.json({
        success: true,
        nextReviewDate: scheduling.nextReviewDate.toISOString(),
        intervalDays: scheduling.intervalDays,
      });
    } catch (error) {
      console.error("Error recording attempt:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao registar tentativa",
      });
    }
  });

  // Record study session (progress tracking)
  app.post("/api/study-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = recordStudySessionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Dados inválidos",
        } as RecordStudySessionResponse);
      }

      const { summaryId, totalFlashcards, correctFlashcards, incorrectFlashcards, studyDate, durationSeconds } = parseResult.data;

      // Verify summary exists and belongs to user
      const summary = await storage.getSummary(summaryId);
      if (!summary || summary.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        } as RecordStudySessionResponse);
      }

      // Create study session
      await storage.createStudySession({
        userId,
        summaryId,
        totalFlashcards,
        correctFlashcards,
        incorrectFlashcards,
        studyDate: new Date(studyDate),
        durationSeconds,
      });

      // Award XP for completing study session
      await awardXP(userId, "complete_study_session", { 
        summaryId,
        correctCards: correctFlashcards,
        totalCards: totalFlashcards,
      });

      return res.json({
        success: true,
      } as RecordStudySessionResponse);
    } catch (error) {
      console.error("Error recording study session:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao registar sessão de estudo",
      } as RecordStudySessionResponse);
    }
  });

  // Get dashboard statistics
  app.get("/api/dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const stats = await storage.getDashboardStats(userId);

      return res.json({
        success: true,
        stats,
      } as GetDashboardStatsResponse);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar estatísticas",
      } as GetDashboardStatsResponse);
    }
  });

  // Get AI-powered review plan
  app.get("/api/review-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user's study history
      const sessions = await storage.getUserStudySessions(userId, 100);
      const summaries = await storage.getUserSummaries(userId);

      // Build study history for AI analysis
      const studyHistoryMap = new Map<string, StudyHistoryItem>();

      for (const session of sessions) {
        const summary = summaries.find(s => s.id === session.summaryId);
        if (!summary) continue;

        const existing = studyHistoryMap.get(session.summaryId);
        const correct = session.correctFlashcards || 0;
        const incorrect = session.incorrectFlashcards || 0;
        const total = correct + incorrect;
        const sessionAccuracy = total > 0 ? (correct / total) * 100 : 0;

        if (existing) {
          // Update with latest data
          existing.studySessions += 1;
          existing.accuracy = (existing.accuracy + sessionAccuracy) / 2; // Average accuracy
          if (new Date(session.studyDate) > new Date(existing.lastStudied)) {
            existing.lastStudied = session.studyDate.toISOString();
          }
        } else {
          studyHistoryMap.set(session.summaryId, {
            fileName: summary.fileName,
            summaryId: summary.id,
            lastStudied: session.studyDate.toISOString(),
            accuracy: sessionAccuracy,
            studySessions: 1,
          });
        }
      }

      const studyHistory = Array.from(studyHistoryMap.values());

      // Generate review plan using AI
      const reviewPlan = await generateReviewPlan(studyHistory);

      // Build a map of summaryIds for easier lookup
      const summaryMap = new Map(studyHistory.map(h => [h.summaryId, h]));

      return res.json({
        success: true,
        reviewPlan: reviewPlan.priorityTopics
          .map(topic => {
            const historyItem = summaryMap.get(topic.summaryId);
            if (!historyItem && topic.summaryId) {
              // If summaryId is provided but not found in history, skip it
              return null;
            }
            if (!historyItem) {
              // If no summaryId was matched, try to find by filename
              const fallbackItem = studyHistory.find(h => 
                h.fileName.toLowerCase().includes(topic.fileName.toLowerCase()) ||
                topic.fileName.toLowerCase().includes(h.fileName.toLowerCase())
              );
              if (!fallbackItem) return null;
              
              return {
                summaryId: fallbackItem.summaryId,
                fileName: fallbackItem.fileName,
                lastStudied: fallbackItem.lastStudied,
                accuracy: fallbackItem.accuracy,
                priority: topic.priority,
                recommendation: topic.reason,
              };
            }
            return {
              summaryId: historyItem.summaryId,
              fileName: historyItem.fileName,
              lastStudied: historyItem.lastStudied,
              accuracy: historyItem.accuracy,
              priority: topic.priority,
              recommendation: topic.reason,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
        aiRecommendation: reviewPlan.recommendations,
      } as GetReviewPlanResponse);
    } catch (error) {
      console.error("Error generating review plan:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao gerar plano de revisão",
      } as GetReviewPlanResponse);
    }
  });

  // Gamification endpoints
  app.get("/api/gamification/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await getGamificationProfile(userId);
      
      return res.json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("Error fetching gamification profile:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar perfil de gamificação",
      });
    }
  });

  app.get("/api/leaderboard", isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await getLeaderboard(limit);
      
      return res.json({
        success: true,
        leaderboard,
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar ranking",
      });
    }
  });

  app.post("/api/premium/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updatedUser = await activatePremium(userId);
      
      return res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error activating premium:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao ativar premium",
      });
    }
  });

  // Class Management Endpoints

  // Create a new class (teacher only)
  app.post("/api/classes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getOrCreateUser(userId, req.user.claims);
      
      if (user.role !== "teacher") {
        return res.status(403).json({
          success: false,
          error: "Apenas professores podem criar turmas",
        });
      }

      const validatedData = insertClassSchema.parse(req.body);
      const newClass = await classService.createClass(userId, validatedData.name, validatedData.description || undefined);
      
      return res.json({
        success: true,
        class: newClass,
      });
    } catch (error) {
      console.error("Error creating class:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao criar turma",
      });
    }
  });

  // Get teacher's classes
  app.get("/api/classes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getOrCreateUser(userId, req.user.claims);
      
      if (user.role === "teacher") {
        const classes = await classService.getTeacherClasses(userId);
        return res.json({
          success: true,
          classes,
        });
      } else {
        const classes = await classService.getStudentClasses(userId);
        return res.json({
          success: true,
          classes,
        });
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar turmas",
      });
    }
  });

  // Get class details and students
  app.get("/api/classes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const classId = req.params.id;
      
      const classRecord = await classService.getClassById(classId);
      if (!classRecord) {
        return res.status(404).json({
          success: false,
          error: "Turma não encontrada",
        });
      }

      const students = await classService.getClassStudents(classId);
      
      return res.json({
        success: true,
        class: classRecord,
        students,
      });
    } catch (error) {
      console.error("Error fetching class details:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar detalhes da turma",
      });
    }
  });

  // Join class with invite code
  app.post("/api/classes/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { inviteCode } = req.body;
      
      if (!inviteCode) {
        return res.status(400).json({
          success: false,
          error: "Código de convite é obrigatório",
        });
      }

      const classRecord = await classService.getClassByInviteCode(inviteCode);
      if (!classRecord) {
        return res.status(404).json({
          success: false,
          error: "Turma não encontrada com este código",
        });
      }

      if (!classRecord.isActive) {
        return res.status(400).json({
          success: false,
          error: "Esta turma não está ativa",
        });
      }

      const enrollment = await classService.enrollStudent(classRecord.id, userId);
      
      return res.json({
        success: true,
        enrollment,
        class: classRecord,
      });
    } catch (error: any) {
      console.error("Error joining class:", error);
      if (error.message === "Student already enrolled in this class") {
        return res.status(400).json({
          success: false,
          error: "Já estás inscrito nesta turma",
        });
      }
      return res.status(500).json({
        success: false,
        error: "Erro ao juntar-se à turma",
      });
    }
  });

  // Remove student from class (teacher only)
  app.delete("/api/classes/:classId/students/:studentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { classId, studentId } = req.params;
      
      await classService.removeStudent(classId, studentId, userId);
      
      return res.json({
        success: true,
      });
    } catch (error: any) {
      console.error("Error removing student:", error);
      return res.status(403).json({
        success: false,
        error: error.message || "Erro ao remover aluno",
      });
    }
  });

  // Leave class (student)
  app.post("/api/classes/:classId/leave", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { classId } = req.params;
      
      await classService.leaveClass(classId, userId);
      
      return res.json({
        success: true,
      });
    } catch (error) {
      console.error("Error leaving class:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao sair da turma",
      });
    }
  });

  // Delete class (teacher only)
  app.delete("/api/classes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const classId = req.params.id;
      
      await classService.deleteClass(classId, userId);
      
      return res.json({
        success: true,
      });
    } catch (error: any) {
      console.error("Error deleting class:", error);
      return res.status(403).json({
        success: false,
        error: error.message || "Erro ao eliminar turma",
      });
    }
  });

  // Update user role
  app.post("/api/user/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      
      if (!role || (role !== "student" && role !== "teacher")) {
        return res.status(400).json({
          success: false,
          error: "Role inválido",
        });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      
      return res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao atualizar role",
      });
    }
  });

  // Subscription management endpoints
  
  // Get current subscription details
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const details = await subscriptionService.getSubscriptionDetails(userId);
      
      return res.json(details);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return res.status(500).json({
        error: "Erro ao carregar subscrição",
      });
    }
  });

  // Create Stripe checkout session for subscription upgrade
  app.post("/api/subscription/create-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { plan } = req.body;

      if (!plan || !["pro", "premium", "educational"].includes(plan)) {
        return res.status(400).json({
          error: "Plano inválido",
        });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(400).json({
          error: "Utilizador sem email válido",
        });
      }

      const subscription = await subscriptionService.getOrCreateSubscription(userId);

      let customerId = subscription.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;

        await subscriptionService.updateSubscriptionPlan(userId, subscription.plan as any, {
          customerId,
        });
      }

      const priceIds: Record<string, string> = {
        pro: process.env.STRIPE_PRICE_ID_PRO || "",
        premium: process.env.STRIPE_PRICE_ID_PREMIUM || "",
        educational: process.env.STRIPE_PRICE_ID_EDUCATIONAL || "",
      };

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price: priceIds[plan],
            quantity: 1,
          },
        ],
        success_url: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/subscription?success=true`,
        cancel_url: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/subscription?canceled=true`,
        metadata: {
          userId,
          plan,
        },
      });

      return res.json({
        url: session.url,
      });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        error: "Erro ao criar sessão de pagamento",
      });
    }
  });

  // Stripe webhook handler
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      return res.status(400).send("Missing stripe signature");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const plan = session.metadata?.plan;

          if (userId && plan && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );

            await subscriptionService.updateSubscriptionPlan(userId, plan as any, {
              customerId: session.customer as string,
              subscriptionId: subscription.id,
              priceId: subscription.items.data[0].price.id,
              currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            });
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = subscription.metadata?.userId;

          if (userId) {
            await subscriptionService.updateSubscriptionPlan(userId, subscription.metadata?.plan as any, {
              currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = subscription.metadata?.userId;

          if (userId) {
            await subscriptionService.updateSubscriptionPlan(userId, "free");
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error handling webhook:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  registerOrganizationRoutes(app);
  registerChatRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
