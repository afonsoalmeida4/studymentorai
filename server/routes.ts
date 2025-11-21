import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Stripe from "stripe";
import PDFDocument from "pdfkit";
import { generateSummary, generateFlashcards, generateReviewPlan, type StudyHistoryItem } from "./openai";
import { getUserLanguage } from "./languageHelper";
import { getOrCreateTranslatedSummary, getOrCreateTranslatedFlashcards, createManualFlashcardWithTranslations } from "./translationService";
import { 
  generateSummaryRequestSchema, 
  generateFlashcardsRequestSchema,
  recordStudySessionRequestSchema,
  recordAttemptSchema,
  insertManualFlashcardSchema,
  updateFlashcardSchema,
  type GenerateSummaryResponse,
  type GenerateFlashcardsResponse,
  type RecordStudySessionResponse,
  type GetDashboardStatsResponse,
  type GetReviewPlanResponse,
  type SupportedLanguage,
  flashcards,
  flashcardAttempts,
  flashcardTranslations,
  topics,
  subjects,
  users,
} from "@shared/schema";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { awardXP, getGamificationProfile, getLeaderboard, activatePremium } from "./gamificationService";
import { registerOrganizationRoutes } from "./organizationRoutes";
import { registerChatRoutes } from "./chatRoutes";
import { registerStatsRoutes } from "./statsRoutes";
import { calculateNextReview } from "./flashcardScheduler";
import { db } from "./db";
import { and, eq, sql, gt, asc, or, inArray } from "drizzle-orm";
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

/**
 * Resolve base flashcard ID for SM-2 progress sharing across languages.
 * If flashcard is a translation, returns the base (PT) flashcard ID.
 * Otherwise returns the flashcard ID itself.
 */
async function resolveBaseFlashcardId(flashcardId: string): Promise<string> {
  // Check if this flashcard is a translation
  const translation = await db.query.flashcardTranslations.findFirst({
    where: eq(flashcardTranslations.translatedFlashcardId, flashcardId),
  });

  if (translation) {
    // This is a translated flashcard - return base flashcard ID
    console.log(`[SM-2 Mapping] Translated flashcard ${flashcardId} → base ${translation.baseFlashcardId}`);
    return translation.baseFlashcardId;
  }

  // This is a base flashcard (PT) or not translated yet
  return flashcardId;
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

      // Get user to access language preference
      const user = await storage.getUser(userId);
      const userLanguage = user?.language || "pt";

      // Check subscription limits for uploads
      const uploadCheck = await subscriptionService.canUpload(userId);
      if (!uploadCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: uploadCheck.reason,
          errorCode: uploadCheck.errorCode,
          params: uploadCheck.params,
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

      // Check if learningStyle is allowed for this user's plan
      const styleCheck = await subscriptionService.canUseLearningStyle(userId, learningStyle);
      if (!styleCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: styleCheck.reason,
          upgradeRequired: true,
        } as GenerateSummaryResponse);
      }

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
          language: userLanguage,
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

  // Export topic summary as PDF (Premium only)
  app.get("/api/topic-summaries/:id/export-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.id;
      
      // Check if user has Premium plan
      const subscription = await subscriptionService.getUserSubscription(userId);
      if (!subscription || subscription.plan !== 'premium') {
        return res.status(403).json({ 
          error: "Esta funcionalidade está disponível apenas no plano Premium",
          errorCode: "PREMIUM_REQUIRED"
        });
      }
      
      // Get topic summary
      const summary = await storage.getTopicSummary(summaryId, userId);
      if (!summary) {
        return res.status(404).json({ error: "Resumo não encontrado" });
      }
      
      // Get topic and subject for context
      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, summary.topicId), eq(topics.userId, userId)),
      });
      if (!topic) {
        return res.status(404).json({ error: "Tópico não encontrado" });
      }
      
      const subject = await db.query.subjects.findFirst({
        where: and(eq(subjects.id, topic.subjectId), eq(subjects.userId, userId)),
      });
      if (!subject) {
        return res.status(404).json({ error: "Disciplina não encontrada" });
      }
      
      // Create PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });
      
      // Set response headers
      const fileName = `${subject.name}-${topic.name}-${summary.learningStyle}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // Add content to PDF
      doc.fontSize(20).font('Helvetica-Bold').text('AI Study Mentor', { align: 'center' });
      doc.moveDown(0.5);
      
      doc.fontSize(16).font('Helvetica-Bold').text(subject.name, { align: 'center' });
      doc.fontSize(14).font('Helvetica').text(topic.name, { align: 'center' });
      doc.moveDown(0.5);
      
      doc.fontSize(10).font('Helvetica-Oblique')
        .text(`Estilo de Aprendizagem: ${summary.learningStyle}`, { align: 'center' });
      doc.moveDown(1);
      
      // Add summary content
      doc.fontSize(12).font('Helvetica');
      const summaryText = summary.summary;
      doc.text(summaryText, {
        align: 'justify',
        lineGap: 5
      });
      
      // Add motivational message if exists
      if (summary.motivationalMessage) {
        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica-BoldOblique')
          .text('💡 Mensagem Motivacional', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Oblique')
          .text(summary.motivationalMessage, {
            align: 'justify',
            lineGap: 3
          });
      }
      
      // Add footer
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica')
        .text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} via AI Study Mentor`, 
          { align: 'center' });
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      console.error("Error exporting PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao exportar PDF" });
      }
    }
  });

  // Generate flashcards from a summary (or topic summary)
  app.post("/api/flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const { summaryId, topicSummaryId } = req.body;
      
      console.log("[Flashcards] Request body:", { summaryId, topicSummaryId, userId });
      
      // Fetch user language preference with robust fallback
      const user = await storage.getUser(userId);
      const userLanguage = getUserLanguage(user?.language);
      
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
          userId,
          topicSummaryId,
          isManual: false,
          language: userLanguage,
          question: fc.question,
          answer: fc.answer,
          summaryId: null,
          subjectId: null,
          topicId: null,
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
          userId,
          summaryId,
          isManual: false,
          language: userLanguage,
          question: fc.question,
          answer: fc.answer,
          topicSummaryId: null,
          subjectId: null,
          topicId: null,
        }));
      }

      const flashcardsData = await generateFlashcards(summaryText, userLanguage);
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

  // Get all user flashcards with filters (MUST be before /api/flashcards/:summaryId to avoid route conflicts)
  app.get("/api/flashcards/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subjectId, topicId, isManual, language } = req.query;

      console.log(`[GET /api/flashcards/user] Query params:`, { subjectId, topicId, isManual, language });

      // Verify PRO/PREMIUM access for manual flashcards only
      const hasAdvancedFlashcards = await subscriptionService.hasFeatureAccess(userId, 'advancedFlashcards');
      console.log(`[GET /api/flashcards/user] Has advanced flashcards:`, hasAdvancedFlashcards);
      
      // If user doesn't have advanced flashcards and is trying to view manual ones, deny
      // But allow viewing auto-generated flashcards for FREE users
      if (!hasAdvancedFlashcards && isManual === 'true') {
        return res.status(403).json({
          success: false,
          error: "Manual flashcards require PRO or PREMIUM plan",
        });
      }

      // Verify ownership of filtered subject/topic if provided
      if (subjectId) {
        const [subject] = await db
          .select()
          .from(subjects)
          .where(and(eq(subjects.id, subjectId as string), eq(subjects.userId, userId)));
        if (!subject) {
          console.log(`[GET /api/flashcards/user] Subject not found:`, subjectId);
          return res.status(404).json({
            success: false,
            error: "Matéria não encontrada",
          });
        }
      }

      if (topicId) {
        const [topic] = await db
          .select()
          .from(topics)
          .where(and(eq(topics.id, topicId as string), eq(topics.userId, userId)));
        if (!topic) {
          console.log(`[GET /api/flashcards/user] Topic not found:`, topicId);
          return res.status(404).json({
            success: false,
            error: "Tópico não encontrado",
          });
        }
      }

      const filters: any = {};
      if (subjectId) filters.subjectId = subjectId as string;
      if (topicId) filters.topicId = topicId as string;
      if (isManual !== undefined) filters.isManual = isManual === 'true';
      if (language) filters.language = language as string;

      // For FREE users, force filter to auto-generated only (unless already filtered)
      if (!hasAdvancedFlashcards && isManual === undefined) {
        filters.isManual = false;
      }

      console.log(`[GET /api/flashcards/user] Filters:`, filters);

      // Remove language filter to get ALL flashcards (we'll translate them)
      delete filters.language;
      const flashcards = await storage.getUserFlashcards(userId, filters);
      console.log(`[GET /api/flashcards/user] Found ${flashcards.length} flashcards (before translation)`);

      // Get user language preference
      const user = await storage.getUser(userId);
      const userLanguage = getUserLanguage(user?.language);
      console.log(`[GET /api/flashcards/user] User language: ${userLanguage}`);

      // Get flashcard IDs for this user to filter translations
      const userFlashcardIds = flashcards.map(fc => fc.id);

      // Build translation maps ONLY for this user's flashcards
      // Map 1: baseFlashcardId -> { language -> translatedFlashcardId }
      const translationMap = new Map<string, Map<string, string>>();
      // Map 2: translatedFlashcardId -> baseFlashcardId (reverse index for O(1) lookup)
      const reverseMap = new Map<string, string>();

      if (userFlashcardIds.length > 0) {
        // Get translations where base OR translated flashcard belongs to this user
        const userTranslations = await db
          .select()
          .from(flashcardTranslations)
          .where(
            or(
              inArray(flashcardTranslations.baseFlashcardId, userFlashcardIds),
              inArray(flashcardTranslations.translatedFlashcardId, userFlashcardIds)
            )
          );

        for (const trans of userTranslations) {
          if (!translationMap.has(trans.baseFlashcardId)) {
            translationMap.set(trans.baseFlashcardId, new Map());
          }
          translationMap.get(trans.baseFlashcardId)!.set(trans.targetLanguage, trans.translatedFlashcardId);
          reverseMap.set(trans.translatedFlashcardId, trans.baseFlashcardId);
        }
      }

      // Create a map of all flashcards for O(1) lookup
      const allFlashcardsMap = new Map(flashcards.map(f => [f.id, f]));

      // Translate flashcards to user's language
      const translatedFlashcards = await Promise.all(
        flashcards.map(async (fc) => {
          // If flashcard is already in user's language, return as is
          if (fc.language === userLanguage) {
            return fc;
          }

          // Find base flashcard ID using reverse index (O(1))
          const baseFlashcardId = reverseMap.get(fc.id) || fc.id;

          // Look for translation in user's language
          const languageMap = translationMap.get(baseFlashcardId);
          if (languageMap) {
            const translatedId = languageMap.get(userLanguage);
            if (translatedId) {
              // First check if already in result set
              const translated = allFlashcardsMap.get(translatedId);
              if (translated) return translated;
              
              // If not, fetch from DB with userId filter for security
              const [fetchedTranslation] = await db
                .select()
                .from(flashcards)
                .where(and(eq(flashcards.id, translatedId), eq(flashcards.userId, userId)))
                .limit(1);
              if (fetchedTranslation) return fetchedTranslation;
            }
          }

          // No translation found, return original flashcard
          return fc;
        })
      );

      const validFlashcards = translatedFlashcards.filter(fc => fc !== undefined);
      console.log(`[GET /api/flashcards/user] Returning ${validFlashcards.length} flashcards in ${userLanguage}`);

      return res.json({
        success: true,
        flashcards: validFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: fc.updatedAt?.toISOString() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching user flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards",
      });
    }
  });

  // Create manual flashcard (PRO/PREMIUM) - MUST be before dynamic routes
  app.post("/api/flashcards/manual", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check PRO/PREMIUM plan requirement
      const permissionCheck = await subscriptionService.canCreateManualFlashcard(userId);
      if (!permissionCheck.allowed) {
        return res.status(403).json({
          success: false,
          errorCode: permissionCheck.errorCode,
          params: permissionCheck.params,
          error: permissionCheck.reason,
        });
      }

      // Validate request body
      const parseResult = insertManualFlashcardSchema.safeParse({
        ...req.body,
        userId,
        isManual: true,
      });

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Dados inválidos",
          details: parseResult.error.errors,
        });
      }

      const flashcardData = parseResult.data;

      // If subjectId provided, verify ownership
      if (flashcardData.subjectId) {
        const [subject] = await db
          .select()
          .from(subjects)
          .where(and(eq(subjects.id, flashcardData.subjectId), eq(subjects.userId, userId)));

        if (!subject) {
          return res.status(404).json({
            success: false,
            error: "Matéria não encontrada",
          });
        }
      }

      // If topicId provided, verify ownership AND hierarchy
      if (flashcardData.topicId) {
        const [topic] = await db
          .select()
          .from(topics)
          .where(and(eq(topics.id, flashcardData.topicId), eq(topics.userId, userId)));

        if (!topic) {
          return res.status(404).json({
            success: false,
            error: "Tópico não encontrado",
          });
        }

        // CRITICAL: Ensure topic belongs to specified subject
        if (flashcardData.subjectId && topic.subjectId !== flashcardData.subjectId) {
          return res.status(400).json({
            success: false,
            error: "O tópico selecionado não pertence à matéria especificada",
          });
        }

        // If topic provided but no subject, auto-fill subject from topic
        if (!flashcardData.subjectId) {
          flashcardData.subjectId = topic.subjectId;
        }
      }

      // Get user for language preference
      const user = await storage.getUser(userId);
      const userLanguage = getUserLanguage(user?.language);

      // Override language if not explicitly provided
      if (!flashcardData.language) {
        flashcardData.language = userLanguage;
      }

      // Create flashcard with automatic translations to all supported languages
      const { baseFlashcard } = await createManualFlashcardWithTranslations({
        question: flashcardData.question,
        answer: flashcardData.answer,
        language: flashcardData.language,
        userId: flashcardData.userId,
        subjectId: flashcardData.subjectId || null,
        topicId: flashcardData.topicId || null,
      });

      return res.json({
        success: true,
        flashcard: {
          ...baseFlashcard,
          createdAt: baseFlashcard.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: baseFlashcard.updatedAt?.toISOString() || new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error creating manual flashcard:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao criar flashcard",
      });
    }
  });

  // Get due manual flashcards for review (SM-2 scheduler) - MUST be before dynamic routes
  app.get("/api/flashcards/manual/due", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subjectId, topicId } = req.query;

      const filters: any = {};
      if (subjectId) filters.subjectId = subjectId as string;
      if (topicId) filters.topicId = topicId as string;

      const dueFlashcards = await storage.getDueManualFlashcards(userId, filters);

      return res.json({
        success: true,
        flashcards: dueFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: fc.updatedAt?.toISOString() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching due manual flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards para revisão",
      });
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
      const requestedLanguage = req.query.language as string | undefined;

      // Get user to access language preference
      const user = await storage.getUser(userId);
      const targetLanguage: SupportedLanguage = requestedLanguage 
        ? getUserLanguage(requestedLanguage) 
        : getUserLanguage(user?.language);

      console.log(`[GET /api/flashcards/:summaryId/due] Requested language: ${targetLanguage}`);

      // Resolve context (supports both summaryId and topicSummaryId)
      const context = await resolveFlashcardContext(summaryId, userId);
      if (!context) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        });
      }

      // Get or create translated flashcards
      let flashcardsInLanguage;
      if (context.type === "topicSummary") {
        // Use new translation service with persistent cache
        flashcardsInLanguage = await getOrCreateTranslatedFlashcards(summaryId, targetLanguage);
      } else {
        // Legacy summary system - use manual translation (no cache)
        flashcardsInLanguage = await db
          .select()
          .from(flashcards)
          .where(
            and(
              eq(flashcards.summaryId, summaryId),
              eq(flashcards.language, targetLanguage)
            )
          );
      }

      console.log(`[GET /api/flashcards/:summaryId/due] Found ${flashcardsInLanguage.length} flashcards in ${targetLanguage}`);

      // Resolve base flashcard IDs for SM-2 progress lookup
      const flashcardIdMappings = await Promise.all(
        flashcardsInLanguage.map(async (fc) => ({
          translatedId: fc.id,
          baseId: await resolveBaseFlashcardId(fc.id),
          flashcard: fc,
        }))
      );

      // Now filter for due flashcards based on attempts (using BASE flashcard IDs)
      const now = new Date();
      const baseFlashcardIds = flashcardIdMappings.map(m => m.baseId);
      
      // Query attempts using BASE flashcard IDs
      const attemptsMap = new Map<string, any>();
      const attemptsResult = await db
        .select()
        .from(flashcardAttempts)
        .where(
          and(
            sql`${flashcardAttempts.flashcardId} IN (${sql.join(baseFlashcardIds.map(id => sql`${id}`), sql`, `)})`,
            eq(flashcardAttempts.userId, userId)
          )
        );
      
      // Map attempts by base flashcard ID
      for (const attempt of attemptsResult) {
        attemptsMap.set(attempt.flashcardId, attempt);
      }

      // Filter due flashcards
      const dueFlashcards = flashcardIdMappings
        .filter(mapping => {
          const attempt = attemptsMap.get(mapping.baseId);
          if (!attempt || !attempt.id) {
            return true; // New flashcard without attempt
          }
          return attempt.nextReviewDate && attempt.nextReviewDate <= now;
        })
        .map(mapping => mapping.flashcard);
      
      // Get next available review date for upcoming flashcards
      const upcomingAttempts = attemptsResult.filter(
        attempt => attempt.nextReviewDate && attempt.nextReviewDate > now
      );
      const nextAvailableAt = upcomingAttempts.length > 0
        ? upcomingAttempts.sort((a, b) => 
            (a.nextReviewDate?.getTime() || 0) - (b.nextReviewDate?.getTime() || 0)
          )[0].nextReviewDate
        : null;
      
      return res.json({
        success: true,
        flashcards: dueFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
        nextAvailableAt: nextAvailableAt?.toISOString() || null,
        language: targetLanguage,
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
      const requestedLanguage = req.query.language as string | undefined;

      // Get user to access language preference
      const user = await storage.getUser(userId);
      const targetLanguage: SupportedLanguage = requestedLanguage 
        ? getUserLanguage(requestedLanguage) 
        : getUserLanguage(user?.language);

      console.log(`[GET /api/flashcards/:summaryId/all] Requested language: ${targetLanguage}`);

      // Resolve context (supports both summaryId and topicSummaryId)
      const context = await resolveFlashcardContext(summaryId, userId);
      if (!context) {
        return res.status(404).json({
          success: false,
          error: "Resumo não encontrado",
        });
      }

      // Get or create translated flashcards
      let allFlashcards;
      if (context.type === "topicSummary") {
        // Use new translation service with persistent cache
        allFlashcards = await getOrCreateTranslatedFlashcards(summaryId, targetLanguage);
      } else {
        // Legacy summary system - use manual translation (no cache)
        allFlashcards = await db
          .select()
          .from(flashcards)
          .where(
            and(
              eq(flashcards.summaryId, summaryId),
              eq(flashcards.language, targetLanguage)
            )
          );
      }

      console.log(`[GET /api/flashcards/:summaryId/all] Returning ${allFlashcards.length} flashcards in ${targetLanguage}`);

      
      return res.json({
        success: true,
        flashcards: allFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
        language: targetLanguage,
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

      // Check if user has advanced flashcards (SM-2 algorithm)
      const hasAdvancedFlashcards = await subscriptionService.hasFeatureAccess(userId, 'advancedFlashcards');
      
      if (!hasAdvancedFlashcards) {
        // FREE plan: basic flashcards only (no SM-2 tracking)
        // Return success but don't save attempt or calculate next review
        return res.json({
          success: true,
          message: "Resposta registada (plano FREE não tem repetição espaçada)",
          basicMode: true,
        });
      }

      // PRO/PREMIUM: Use SM-2 algorithm for spaced repetition
      // Resolve base flashcard ID for SM-2 progress sharing across languages
      const baseFlashcardId = await resolveBaseFlashcardId(flashcardId);

      // Get latest attempt for BASE flashcard (shared across all translations)
      const latestAttempt = await storage.getLatestAttempt(userId, baseFlashcardId);

      // Calculate next review using SM-2 algorithm
      const scheduling = calculateNextReview(rating, latestAttempt);

      // Save attempt to BASE flashcard (ensures progress shared across languages)
      await storage.createFlashcardAttempt({
        userId,
        flashcardId: baseFlashcardId,
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

  // Update flashcard (manual or auto-generated)
  app.patch("/api/flashcards/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flashcardId = req.params.id;

      // Validate request body
      const parseResult = updateFlashcardSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Dados inválidos",
          details: parseResult.error.errors,
        });
      }

      // Verify flashcard exists and belongs to user BEFORE attempting update
      const flashcard = await storage.getFlashcard(flashcardId);
      if (!flashcard) {
        return res.status(404).json({
          success: false,
          error: "Flashcard não encontrado",
        });
      }

      if (flashcard.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Sem permissão para editar este flashcard",
        });
      }

      const updated = await storage.updateFlashcard(flashcardId, userId, parseResult.data);

      // This should never be null due to prior validation, but defensive check
      if (!updated) {
        return res.status(500).json({
          success: false,
          error: "Erro inesperado ao atualizar flashcard",
        });
      }

      return res.json({
        success: true,
        flashcard: {
          ...updated,
          createdAt: updated.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: updated.updatedAt?.toISOString() || new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error updating flashcard:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao atualizar flashcard",
      });
    }
  });

  // Delete flashcard
  app.delete("/api/flashcards/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flashcardId = req.params.id;

      // Verify flashcard exists and belongs to user BEFORE attempting delete
      const flashcard = await storage.getFlashcard(flashcardId);
      if (!flashcard) {
        return res.status(404).json({
          success: false,
          error: "Flashcard não encontrado",
        });
      }

      if (flashcard.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Sem permissão para eliminar este flashcard",
        });
      }

      const deleted = await storage.deleteFlashcard(flashcardId, userId);

      // This should never be false due to prior validation, but defensive check
      if (!deleted) {
        return res.status(500).json({
          success: false,
          error: "Erro inesperado ao eliminar flashcard",
        });
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error("Error deleting flashcard:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao deletar flashcard",
      });
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

  // Update user language preference
  app.post("/api/user/language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language } = req.body;
      
      const validLanguages = ["pt", "en", "es", "fr", "de", "it"];
      if (!language || !validLanguages.includes(language)) {
        return res.status(400).json({
          success: false,
          error: "Idioma inválido",
        });
      }

      const updatedUser = await storage.updateUserLanguage(userId, language);
      
      return res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user language:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao atualizar idioma",
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

  // Cancel subscription and revert to free plan
  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await subscriptionService.cancelSubscription(userId);
      
      return res.json({
        success: true,
        subscription,
      });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      return res.status(400).json({
        error: error.message || "Erro ao cancelar subscrição",
      });
    }
  });

  // Create Stripe checkout session for subscription upgrade
  app.post("/api/subscription/create-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { plan, billingPeriod = "monthly" } = req.body;

      if (!plan || !["pro", "premium"].includes(plan)) {
        return res.status(400).json({
          error: "Plano inválido",
        });
      }

      if (!["monthly", "yearly"].includes(billingPeriod)) {
        return res.status(400).json({
          error: "Período de faturação inválido",
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

      // Map plan + billing period to Stripe Price IDs
      const priceIds: Record<string, Record<string, string>> = {
        pro: {
          monthly: process.env.STRIPE_PRICE_ID_PRO || "",
          yearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY || process.env.STRIPE_PRICE_ID_PRO || "",
        },
        premium: {
          monthly: process.env.STRIPE_PRICE_ID_PREMIUM || "",
          yearly: process.env.STRIPE_PRICE_ID_PREMIUM_YEARLY || process.env.STRIPE_PRICE_ID_PREMIUM || "",
        },
      };

      const priceId = priceIds[plan]?.[billingPeriod];
      
      if (!priceId) {
        return res.status(400).json({
          error: "Price ID não configurado para este plano",
        });
      }

      // Build URLs using the actual host from the request to avoid stale domains
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      let host = req.get('host') || req.get('x-forwarded-host') || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
      
      // In development, ensure port :5000 is included if not already present
      const isProduction = process.env.NODE_ENV === "production";
      if (!isProduction && host && !host.includes(':')) {
        host = `${host}:5000`;
      }
      
      const fullBaseUrl = `${protocol}://${host}`;

      console.log('[Stripe Checkout] Creating session with URLs:', {
        success: `${fullBaseUrl}/subscription?success=true`,
        cancel: `${fullBaseUrl}/subscription?canceled=true`,
        protocol,
        host,
        fullBaseUrl,
      });

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${fullBaseUrl}/subscription?success=true`,
        cancel_url: `${fullBaseUrl}/subscription?canceled=true`,
        metadata: {
          userId,
          plan,
          billingPeriod,
        },
      });

      console.log('[Stripe Checkout] Session created:', session.id);

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

  // TEMPORARY: Migrate old flashcards to have translations
  app.post("/api/admin/migrate-flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`[MIGRATE] Starting flashcard migration for user ${userId}`);

      // Get all flashcards without translations
      const flashcardsWithoutTranslations = await db
        .select()
        .from(flashcards)
        .leftJoin(flashcardTranslations, eq(flashcards.id, flashcardTranslations.baseFlashcardId))
        .where(and(
          eq(flashcards.userId, userId),
          sql`${flashcardTranslations.id} IS NULL`
        ));

      console.log(`[MIGRATE] Found ${flashcardsWithoutTranslations.length} flashcards without translations`);

      const results = [];
      for (const row of flashcardsWithoutTranslations) {
        const baseFlashcard = row.flashcards;
        const baseLanguage = baseFlashcard.language as SupportedLanguage;
        
        console.log(`[MIGRATE] Processing flashcard ${baseFlashcard.id} (${baseLanguage})`);

        // Skip if already has translations (shouldn't happen but safety check)
        const existingTranslations = await db
          .select()
          .from(flashcardTranslations)
          .where(eq(flashcardTranslations.baseFlashcardId, baseFlashcard.id));
        
        if (existingTranslations.length > 0) {
          console.log(`[MIGRATE] Skipping ${baseFlashcard.id} - already has translations`);
          continue;
        }

        try {
          // Translate to all other languages
          const allLanguages: SupportedLanguage[] = ["pt", "en", "es", "fr", "de", "it"];
          const targetLanguages = allLanguages.filter(lang => lang !== baseLanguage);

          const translationsData = [];
          for (const targetLang of targetLanguages) {
            const translationService = await import("./translationService");
            const translatedData = await translationService.translateFlashcardsText(
              [{ question: baseFlashcard.question, answer: baseFlashcard.answer }],
              baseLanguage,
              targetLang
            );
            translationsData.push({
              language: targetLang,
              question: translatedData[0].question,
              answer: translatedData[0].answer,
            });
          }

          // Create translated flashcards and mappings in transaction
          await db.transaction(async (tx) => {
            const translationMappings = [];
            
            for (const translation of translationsData) {
              const [translatedFlashcard] = await tx
                .insert(flashcards)
                .values({
                  userId: baseFlashcard.userId,
                  question: translation.question,
                  answer: translation.answer,
                  language: translation.language,
                  isManual: baseFlashcard.isManual,
                  subjectId: baseFlashcard.subjectId,
                  topicId: baseFlashcard.topicId,
                  summaryId: baseFlashcard.summaryId,
                  topicSummaryId: baseFlashcard.topicSummaryId,
                })
                .returning();

              translationMappings.push({
                baseFlashcardId: baseFlashcard.id,
                translatedFlashcardId: translatedFlashcard.id,
                targetLanguage: translation.language,
              });
            }

            // Create translation mappings
            if (translationMappings.length > 0) {
              await tx.insert(flashcardTranslations).values(translationMappings);
            }
          });

          results.push({
            flashcardId: baseFlashcard.id,
            status: "success",
            translationsCreated: translationsData.length,
          });
          console.log(`[MIGRATE] Successfully migrated ${baseFlashcard.id}`);
        } catch (error) {
          console.error(`[MIGRATE] Failed to migrate ${baseFlashcard.id}:`, error);
          results.push({
            flashcardId: baseFlashcard.id,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Generate detailed summary
      const successCount = results.filter(r => r.status === "success").length;
      const failedCount = results.filter(r => r.status === "failed").length;
      const totalTranslationsCreated = results
        .filter(r => r.status === "success")
        .reduce((sum, r) => sum + (r.translationsCreated || 0), 0);

      console.log(`[MIGRATE] Migration complete - Success: ${successCount}, Failed: ${failedCount}, Translations created: ${totalTranslationsCreated}`);

      return res.json({
        success: true,
        message: `Migration completed: ${successCount} flashcards migrated, ${failedCount} failed`,
        summary: {
          totalProcessed: flashcardsWithoutTranslations.length,
          successCount,
          failedCount,
          totalTranslationsCreated,
        },
        results,
      });
    } catch (error) {
      console.error("[MIGRATE] Migration error:", error);
      return res.status(500).json({
        success: false,
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  registerOrganizationRoutes(app);
  registerChatRoutes(app);
  registerStatsRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
