import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { generateSummary, generateFlashcards, generateReviewPlan, type StudyHistoryItem } from "./openai";
import { 
  generateSummaryRequestSchema, 
  generateFlashcardsRequestSchema,
  recordStudySessionRequestSchema,
  type GenerateSummaryResponse,
  type GenerateFlashcardsResponse,
  type RecordStudySessionResponse,
  type GetDashboardStatsResponse,
  type GetReviewPlanResponse,
} from "@shared/schema";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { awardXP, getGamificationProfile, getLeaderboard, activatePremium } from "./gamificationService";
import { registerOrganizationRoutes } from "./organizationRoutes";
import { registerChatRoutes } from "./chatRoutes";

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

        // Save to database
        const savedSummary = await storage.createSummary({
          userId,
          fileName: req.file.originalname,
          learningStyle,
          summary,
          motivationalMessage,
          isFavorite: false,
        });

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

  // Generate flashcards from a summary
  app.post("/api/flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const parseResult = generateFlashcardsRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "ID do resumo inválido",
        } as GenerateFlashcardsResponse);
      }

      const { summaryId } = parseResult.data;

      // Check if summary exists and belongs to user
      const summary = await storage.getSummary(summaryId);
      if (!summary || summary.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        } as GenerateFlashcardsResponse);
      }

      // Check if flashcards already exist
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

      // Generate flashcards using GPT-5
      const flashcardsData = await generateFlashcards(summary.summary);

      // Save flashcards to database
      const savedFlashcards = await storage.createFlashcards(
        flashcardsData.map(fc => ({
          summaryId,
          question: fc.question,
          answer: fc.answer,
        }))
      );

      // Award XP for creating flashcards
      await awardXP(userId, "create_flashcards", { 
        summaryId,
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

  registerOrganizationRoutes(app);
  registerChatRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
