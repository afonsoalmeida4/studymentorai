import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import { generateSummary, generateFlashcards, generateReviewPlan, generateQuiz, type StudyHistoryItem } from "./openai";
import { getUserLanguage, normalizeLanguage } from "./languageHelper";
import { getOrCreateTranslatedSummary, getOrCreateTranslatedFlashcards, createManualFlashcardWithTranslations } from "./translationService";
import { 
  generateSummaryRequestSchema, 
  generateFlashcardsRequestSchema,
  recordStudySessionRequestSchema,
  recordAttemptSchema,
  insertManualFlashcardSchema,
  updateFlashcardSchema,
  generateQuizRequestSchema,
  submitQuizAnswersSchema,
  type GenerateSummaryResponse,
  type GenerateFlashcardsResponse,
  type RecordStudySessionResponse,
  type GetDashboardStatsResponse,
  type GetReviewPlanResponse,
  type SupportedLanguage,
  type Flashcard,
  type QuizDifficulty,
  flashcards,
  flashcardAttempts,
  flashcardTranslations,
  topics,
  subjects,
  users,
  calendarEvents,
  topicSummaries,
  quizzes,
  quizQuestions,
  quizAttempts,
  quizQuestionAnswers,
  insertCalendarEventSchema,
  type CalendarEvent,
} from "@shared/schema";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./supabaseAuth";
import { awardXP, getGamificationProfile, getLeaderboard, activatePremium } from "./gamificationService";
import { registerOrganizationRoutes } from "./organizationRoutes";
import { registerChatRoutes } from "./chatRoutes";
import { registerStatsRoutes } from "./statsRoutes";
import { calculateNextReview } from "./flashcardScheduler";
import { db } from "./db";
import { and, eq, sql, gt, asc, desc, or, inArray } from "drizzle-orm";
import { subscriptionService } from "./subscriptionService";
import { costControlService } from "./costControlService";
import { usageLimitsService } from "./usageLimitsService";

async function requirePremium(req: any, res: any, next: any) {
  try {
    const userId = req.user.claims.sub;
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    
    if (subscription.plan !== "premium") {
      return res.status(403).json({
        success: false,
        error: "PREMIUM_REQUIRED",
        message: "Esta funcionalidade está disponível apenas para utilizadores Premium.",
        upgradeRequired: true,
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking premium status:", error);
    res.status(500).json({ success: false, error: "Erro ao verificar subscrição" });
  }
}

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 exports per window
  message: { error: "Demasiados pedidos de export. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory cache for bundled flashcards (TTL: 60 seconds)
const bundledFlashcardsCache = new Map<string, { data: any; timestamp: number; userId: string }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// Helper to invalidate cache for a topic
const invalidateBundledCache = (topicId: string) => {
  const keysToDelete: string[] = [];
  bundledFlashcardsCache.forEach((_, key) => {
    if (key.startsWith(`${topicId}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => bundledFlashcardsCache.delete(key));
  console.log(`[Cache] Invalidated bundled cache for topic ${topicId}`);
};

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

      // INVISIBLE COST CONTROL: Silently check file size based on plan
      const planTier = await costControlService.getUserPlanTier(userId);
      const fileSizeCheck = costControlService.validateFileSize(req.file.size, planTier);
      // Note: We never block - just process what we can

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

      // Check monthly usage limit for summaries
      const summaryLimitCheck = await usageLimitsService.checkFeatureLimit(userId, "summaries", userLanguage);
      if (!summaryLimitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: summaryLimitCheck.message,
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

        // INVISIBLE COST CONTROL: Silently trim input based on plan (planTier already fetched above)
        pdfText = costControlService.trimInputText(pdfText, planTier);
      } catch (error) {
        console.error("Error extracting PDF text:", error);
        return res.status(400).json({
          success: false,
          error: "Erro ao extrair texto do PDF. Verifique se o ficheiro não está corrompido.",
        } as GenerateSummaryResponse);
      }

      // Generate summary using GPT-5 with plan-based depth
      try {
        // INVISIBLE COST CONTROL: Apply plan-based depth and token limits (planTier already fetched above)
        const depthModifier = costControlService.getSummaryDepthModifier(planTier, userLanguage);
        const maxTokens = costControlService.getMaxCompletionTokens(planTier, "summary");
        
        // Check and apply soft daily limits (delays, never blocks)
        const usageCheck = await costControlService.checkDailyUsage(userId, "summary", planTier);
        if (usageCheck.shouldDelay) {
          await costControlService.applyDelayIfNeeded(usageCheck.delayMs);
        }
        
        const { summary, motivationalMessage } = await generateSummary({
          text: pdfText,
          learningStyle,
          language: userLanguage,
          depthModifier,
          maxCompletionTokens: maxTokens,
        });
        
        // Increment daily usage counter
        costControlService.incrementDailyUsage(userId, "summary");

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
          usageLimitsService.recordUsage(userId, "summaries", 1),
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
  app.get("/api/topic-summaries/:id/export-pdf", isAuthenticated, requirePremium, exportLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.id;
      
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
      doc.fontSize(20).font('Helvetica-Bold').text('Study Mentor AI', { align: 'center' });
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
        .text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} via Study Mentor AI`, 
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

  // Export topic summary as DOCX (Premium only)
  app.get("/api/topic-summaries/:id/export-docx", isAuthenticated, requirePremium, exportLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summaryId = req.params.id;
      
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
      
      // Create DOCX document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header
            new Paragraph({
              text: "Study Mentor AI",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: subject.name,
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: topic.name,
              heading: HeadingLevel.HEADING_3,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Estilo de Aprendizagem: ${summary.learningStyle}`,
                  italics: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            // Summary content
            ...summary.summary.split('\n').map(line => 
              new Paragraph({
                text: line,
                spacing: { after: 120 },
                alignment: AlignmentType.JUSTIFIED,
              })
            ),
            // Motivational message if exists
            ...(summary.motivationalMessage ? [
              new Paragraph({
                text: "",
                spacing: { before: 400 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "💡 Mensagem Motivacional",
                    bold: true,
                    italics: true,
                  }),
                ],
                spacing: { after: 200 },
              }),
              ...summary.motivationalMessage.split('\n').map(line =>
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line,
                      italics: true,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 120 },
                  alignment: AlignmentType.JUSTIFIED,
                })
              ),
            ] : []),
            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Gerado em ${new Date().toLocaleDateString('pt-PT')} via Study Mentor AI`,
                  size: 16,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }],
      });
      
      // Generate DOCX buffer
      const buffer = await Packer.toBuffer(doc);
      
      // Set response headers
      const fileName = `${subject.name}-${topic.name}-${summary.learningStyle}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Length', buffer.length);
      
      // Send buffer
      res.send(buffer);
      
    } catch (error) {
      console.error("Error exporting DOCX:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao exportar DOCX" });
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
      
      // INVISIBLE COST CONTROL: Use plan-based flashcard limits
      const planTier = await costControlService.getUserPlanTier(userId);
      const maxFlashcards = costControlService.getMaxFlashcardsPerBatch(planTier);
      const flashcardMaxTokens = costControlService.getMaxCompletionTokens(planTier, "flashcard");
      
      // Check and apply soft daily limits (delays, never blocks)
      const usageCheck = await costControlService.checkDailyUsage(userId, "flashcard", planTier);
      if (usageCheck.shouldDelay) {
        await costControlService.applyDelayIfNeeded(usageCheck.delayMs);
      }
      
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
        
        // Check if FREE user has reached limit
        if (existingFlashcards.length >= 10 && maxFlashcards !== null) {
          // FREE user with 10+ flashcards - return existing, don't generate more
          return res.json({
            success: true,
            flashcards: existingFlashcards.map(fc => ({
              ...fc,
              createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
            })),
          } as GenerateFlashcardsResponse);
        }
        
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
        console.log("[Flashcards] Summary text type:", typeof summaryText);
        console.log("[Flashcards] Summary text length:", summaryText?.length || 0);
        console.log("[Flashcards] Summary text preview:", JSON.stringify(summaryText?.substring(0, 100)));
        
        // Get topic to populate topicId and subjectId for proper filtering
        const [relatedTopic] = await db
          .select()
          .from(topics)
          .where(eq(topics.id, topicSummary.topicId));
        const topicIdForFlashcards = topicSummary.topicId;
        const subjectIdForFlashcards = relatedTopic?.subjectId || null;
        
        flashcardsQuery = (flashcardsData: any[]) => flashcardsData.map((fc: any) => ({
          userId,
          topicSummaryId,
          isManual: false,
          language: userLanguage,
          question: fc.question,
          answer: fc.answer,
          summaryId: null,
          subjectId: subjectIdForFlashcards,
          topicId: topicIdForFlashcards,
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

      // INVISIBLE COST CONTROL: Trim summary text based on plan
      const trimmedSummaryText = costControlService.trimInputText(summaryText, planTier);
      
      // Check monthly usage limit for flashcards before generation
      // Estimate flashcard count (typically 5-10 per summary)
      const estimatedFlashcards = maxFlashcards || 10;
      const flashcardLimitCheck = await usageLimitsService.checkFeatureLimit(userId, "flashcards", userLanguage, estimatedFlashcards);
      if (!flashcardLimitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: flashcardLimitCheck.message,
          upgradeRequired: true,
        } as GenerateFlashcardsResponse);
      }
      
      // For first-time generation, pass empty array (no existing questions to avoid)
      const flashcardsData = await generateFlashcards(trimmedSummaryText, userLanguage, maxFlashcards, flashcardMaxTokens, []);
      const savedFlashcards = await storage.createFlashcards(flashcardsQuery(flashcardsData));
      
      // Record monthly usage for flashcards
      await usageLimitsService.recordUsage(userId, "flashcards", savedFlashcards.length);
      
      // Increment daily usage counter
      costControlService.incrementDailyUsage(userId, "flashcard");

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

  // Regenerate flashcards for upgraded users (PRO/PREMIUM only)
  // Flashcards are generated in Portuguese (base language) and immediately translated
  // to the target language if different from Portuguese
  app.post("/api/flashcards/regenerate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicSummaryId, targetLanguage } = req.body;
      
      // Normalize target language to supported language code
      const normalizedTargetLanguage = normalizeLanguage(targetLanguage, "pt");

      if (!topicSummaryId) {
        return res.status(400).json({
          success: false,
          error: "topicSummaryId é obrigatório",
        });
      }

      // Get user plan
      const planTier = await costControlService.getUserPlanTier(userId);
      const maxFlashcards = costControlService.getMaxFlashcardsPerBatch(planTier);

      // Only allow regeneration for PRO/PREMIUM users (unlimited flashcards)
      if (maxFlashcards !== null) {
        return res.status(403).json({
          success: false,
          error: "Regeneração de flashcards disponível apenas para utilizadores PRO ou PREMIUM",
        });
      }

      // Verify topic summary ownership
      const topicSummary = await storage.getTopicSummary(topicSummaryId, userId);
      if (!topicSummary) {
        return res.status(404).json({
          success: false,
          error: "Resumo do tópico não encontrado",
        });
      }

      const topicId = topicSummary.topicId;
      
      // Get the topic to find subjectId
      const topic = await db.query.topics.findFirst({
        where: eq(topics.id, topicId),
      });
      const subjectId = topic?.subjectId || null;
      
      console.log(`[Regenerate Flashcards] Generating flashcards from summary ${topicSummaryId} for topic ${topicId}, target language: ${normalizedTargetLanguage}`);

      // Count existing flashcards for this topic (all languages, no filtering)
      const allTopicSummariesForCount = await db.query.topicSummaries.findMany({
        where: eq(topicSummaries.topicId, topicId),
      });
      const allSummaryIds = allTopicSummariesForCount.map(s => s.id);
      
      let existingTopicFlashcards: Flashcard[] = [];
      if (allSummaryIds.length > 0) {
        existingTopicFlashcards = await db.query.flashcards.findMany({
          where: inArray(flashcards.topicSummaryId, allSummaryIds),
        });
      }
      
      // Also get manual flashcards for this topic
      const manualFlashcards = await db.query.flashcards.findMany({
        where: and(
          eq(flashcards.topicId, topicId),
          eq(flashcards.isManual, true)
        ),
      });
      
      // Combine and deduplicate for accurate count
      const allExisting = [...existingTopicFlashcards, ...manualFlashcards];
      const seenIds = new Set<string>();
      const uniqueExisting = allExisting.filter(fc => {
        if (seenIds.has(fc.id)) return false;
        seenIds.add(fc.id);
        return true;
      });
      const existingCount = uniqueExisting.length;

      // Get cost control settings
      const flashcardMaxTokens = costControlService.getMaxCompletionTokens(planTier, "flashcard");

      // Generate flashcards in the user's selected language
      const trimmedSummaryText = costControlService.trimInputText(topicSummary.summary, planTier);

      // Check monthly usage limit for flashcards before regeneration
      const flashcardLimitCheck = await usageLimitsService.checkFeatureLimit(userId, "flashcards", normalizedTargetLanguage, 10);
      if (!flashcardLimitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: flashcardLimitCheck.message,
          upgradeRequired: true,
        });
      }

      // Extract existing questions to avoid duplicates (lightweight - just questions, not full flashcards)
      const existingQuestions = uniqueExisting.map(fc => fc.question);
      console.log(`[Regenerate Flashcards] Avoiding ${existingQuestions.length} existing questions`);

      // Generate flashcards in the user's selected language, avoiding duplicates
      const flashcardsData = await generateFlashcards(trimmedSummaryText, normalizedTargetLanguage, null, flashcardMaxTokens, existingQuestions);

      // Post-generation filter: remove any duplicates that GPT might have returned despite prompt instructions
      // Also track accepted questions to prevent intra-batch duplicates
      const seenQuestionsLower = new Set(existingQuestions.map(q => q.toLowerCase().trim()));
      const uniqueNewFlashcards = flashcardsData.filter((fc: any) => {
        const questionLower = fc.question.toLowerCase().trim();
        if (seenQuestionsLower.has(questionLower)) {
          console.log(`[Regenerate Flashcards] Filtered duplicate question: "${fc.question.substring(0, 50)}..."`);
          return false;
        }
        // Add this question to seen set to prevent intra-batch duplicates
        seenQuestionsLower.add(questionLower);
        return true;
      });
      
      console.log(`[Regenerate Flashcards] Post-filter: ${flashcardsData.length} generated, ${uniqueNewFlashcards.length} unique`);

      // If no new flashcards could be generated (all content covered), return success with message
      if (uniqueNewFlashcards.length === 0) {
        console.log(`[Regenerate Flashcards] All content already covered - no new flashcards generated`);
        return res.json({
          success: true,
          flashcards: [],
          previousCount: existingCount,
          newCount: existingCount,
          addedCount: 0,
          allContentCovered: true,
        });
      }

      // Save new flashcards in the user's selected language
      const newFlashcards = await storage.createFlashcards(
        uniqueNewFlashcards.map((fc: any) => ({
          userId,
          topicSummaryId: topicSummaryId,
          topicId: topicId,
          subjectId: subjectId,
          isManual: false,
          language: normalizedTargetLanguage,
          question: fc.question,
          answer: fc.answer,
          summaryId: null,
        }))
      );
      
      console.log(`[Regenerate Flashcards] Created ${newFlashcards.length} flashcards in ${normalizedTargetLanguage}`);

      // Record monthly usage for flashcards
      await usageLimitsService.recordUsage(userId, "flashcards", newFlashcards.length);
      
      // Increment daily usage counter
      costControlService.incrementDailyUsage(userId, "flashcard");

      // Calculate new total count for the entire topic
      const newTotalCount = existingCount + newFlashcards.length;

      // Invalidate bundled cache for this topic so frontend gets fresh data
      if (topicId) {
        invalidateBundledCache(topicId);
      }

      console.log(`[Regenerate Flashcards] Added ${newFlashcards.length} flashcards (target: ${normalizedTargetLanguage}) to topic (${existingCount} → ${newTotalCount})`);

      return res.json({
        success: true,
        flashcards: newFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
        previousCount: existingCount,
        newCount: newTotalCount,
        addedCount: newFlashcards.length,
        allContentCovered: false,
        language: normalizedTargetLanguage,
      });
    } catch (error) {
      console.error("Error regenerating flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao regenerar flashcards. Por favor, tente novamente.",
      });
    }
  });

  // Get all user flashcards with filters (MUST be before /api/flashcards/:summaryId to avoid route conflicts)
  app.get("/api/flashcards/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subjectId, topicId, isManual, language } = req.query;

      console.log(`[GET /api/flashcards/user] Query params:`, { subjectId, topicId, isManual, language });

      // All users can view and manage flashcards (manual flashcards are available to all plans)

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

      console.log(`[GET /api/flashcards/user] Filters:`, filters);

      // SIMPLIFIED: Get all flashcards directly - no translation mapping needed
      // Each flashcard has its own language field and is treated independently
      const userFlashcardsList = await storage.getUserFlashcards(userId, filters);
      console.log(`[GET /api/flashcards/user] Found ${userFlashcardsList.length} flashcards`);

      return res.json({
        success: true,
        flashcards: userFlashcardsList.map(fc => ({
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

      // Get user for language preference - flashcards stay in the language they were created
      const user = await storage.getUser(userId);
      const userLanguage = getUserLanguage(user?.language);

      // Override language if not explicitly provided
      if (!flashcardData.language) {
        flashcardData.language = userLanguage;
      }

      // Create flashcard in the user's current language (no automatic translations)
      const [createdFlashcard] = await db
        .insert(flashcards)
        .values({
          question: flashcardData.question,
          answer: flashcardData.answer,
          language: flashcardData.language,
          userId: flashcardData.userId,
          subjectId: flashcardData.subjectId || null,
          topicId: flashcardData.topicId || null,
          isManual: true,
        })
        .returning();

      // Invalidate bundled flashcards cache for this topic (if topicId provided)
      if (flashcardData.topicId) {
        bundledFlashcardsCache.delete(`${flashcardData.topicId}:${userId}`);
        console.log(`[POST /api/flashcards/manual] Cache invalidated for topic ${flashcardData.topicId}`);
      }

      return res.json({
        success: true,
        flashcard: {
          ...createdFlashcard,
          createdAt: createdFlashcard.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: createdFlashcard.updatedAt?.toISOString() || new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error creating manual flashcard:", error);
      return res.status(500).json({
        success: false,
        errorCode: "FLASHCARD_CREATE_ERROR",
        error: "Failed to create flashcard",
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
      let generatedFlashcards: Flashcard[] = [];
      let manualFlashcards: Flashcard[] = [];
      
      if (context.type === "topicSummary") {
        // Use new translation service with persistent cache
        generatedFlashcards = await getOrCreateTranslatedFlashcards(summaryId, targetLanguage);
        
        // Also fetch manual flashcards for this topic
        const topicSummary = await db.query.topicSummaries.findFirst({
          where: eq(topicSummaries.id, summaryId),
        });
        
        if (topicSummary?.topicId) {
          // Get manual flashcards for this topic
          // For Portuguese: get base manual flashcards directly
          // For other languages: get translations via flashcard_translations
          
          if (targetLanguage === "pt") {
            // Portuguese is base - get manual flashcards directly
            manualFlashcards = await db.query.flashcards.findMany({
              where: and(
                eq(flashcards.topicId, topicSummary.topicId),
                eq(flashcards.language, "pt"),
                eq(flashcards.isManual, true)
              ),
              orderBy: (flashcards, { asc }) => [asc(flashcards.createdAt)],
            });
          } else {
            // For other languages: find base PT manual flashcards, then get translations
            const baseManualFlashcards = await db.query.flashcards.findMany({
              where: and(
                eq(flashcards.topicId, topicSummary.topicId),
                eq(flashcards.language, "pt"),
                eq(flashcards.isManual, true)
              ),
              orderBy: (flashcards, { asc }) => [asc(flashcards.createdAt)],
            });
            
            if (baseManualFlashcards.length > 0) {
              const baseIds = baseManualFlashcards.map(fc => fc.id);
              
              // Get translation mappings for these base flashcards
              const mappings = await db.query.flashcardTranslations.findMany({
                where: and(
                  inArray(flashcardTranslations.baseFlashcardId, baseIds),
                  eq(flashcardTranslations.targetLanguage, targetLanguage)
                ),
              });
              
              if (mappings.length > 0) {
                const translatedIds = mappings.map(m => m.translatedFlashcardId);
                const translatedManual = await db.query.flashcards.findMany({
                  where: inArray(flashcards.id, translatedIds),
                });
                
                // Order by base flashcard order
                const baseIdOrder = new Map(baseIds.map((id, idx) => [id, idx]));
                const mappingByTranslated = new Map(mappings.map(m => [m.translatedFlashcardId, m.baseFlashcardId]));
                
                manualFlashcards = translatedManual.sort((a, b) => {
                  const orderA = baseIdOrder.get(mappingByTranslated.get(a.id) || "") || 0;
                  const orderB = baseIdOrder.get(mappingByTranslated.get(b.id) || "") || 0;
                  return orderA - orderB;
                });
              }
            }
          }
        }
      } else {
        // Legacy summary system - use manual translation (no cache)
        generatedFlashcards = await db
          .select()
          .from(flashcards)
          .where(
            and(
              eq(flashcards.summaryId, summaryId),
              eq(flashcards.language, targetLanguage)
            )
          );
      }

      // Combine generated and manual flashcards
      const allFlashcards = [...generatedFlashcards, ...manualFlashcards];

      console.log(`[GET /api/flashcards/:summaryId/all] Returning ${allFlashcards.length} flashcards (${generatedFlashcards.length} generated + ${manualFlashcards.length} manual) in ${targetLanguage}`);

      
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

  // Get ALL flashcards for a TOPIC (from all summaries) - for topic-view.tsx
  app.get("/api/flashcards/topic/:topicId/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.topicId;
      const requestedLanguage = req.query.language as string | undefined;

      // Get user to access language preference
      const user = await storage.getUser(userId);
      const targetLanguage: SupportedLanguage = requestedLanguage 
        ? getUserLanguage(requestedLanguage) 
        : getUserLanguage(user?.language);

      console.log(`[GET /api/flashcards/topic/:topicId/all] Requested language: ${targetLanguage}, topicId: ${topicId}`);

      // Verify topic belongs to user
      const topic = await db.query.topics.findFirst({
        where: eq(topics.id, topicId),
        with: { subject: true },
      });
      
      if (!topic || topic.subject?.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Tópico não encontrado",
        });
      }

      // Get ALL summaries for this topic
      const allSummaries = await db.query.topicSummaries.findMany({
        where: eq(topicSummaries.topicId, topicId),
      });

      // Collect flashcards from all summaries - PARALLELIZED for speed
      const flashcardPromises = allSummaries.map(summary => 
        getOrCreateTranslatedFlashcards(summary.id, targetLanguage)
      );
      const flashcardArrays = await Promise.all(flashcardPromises);
      const allGeneratedFlashcards: Flashcard[] = flashcardArrays.flat();

      // Also fetch manual flashcards for this topic
      let manualFlashcards: Flashcard[] = [];
      if (targetLanguage === "pt") {
        manualFlashcards = await db.query.flashcards.findMany({
          where: and(
            eq(flashcards.topicId, topicId),
            eq(flashcards.language, "pt"),
            eq(flashcards.isManual, true)
          ),
          orderBy: (flashcards, { asc }) => [asc(flashcards.createdAt)],
        });
      } else {
        const baseManualFlashcards = await db.query.flashcards.findMany({
          where: and(
            eq(flashcards.topicId, topicId),
            eq(flashcards.language, "pt"),
            eq(flashcards.isManual, true)
          ),
          orderBy: (flashcards, { asc }) => [asc(flashcards.createdAt)],
        });
        
        if (baseManualFlashcards.length > 0) {
          const baseIds = baseManualFlashcards.map(fc => fc.id);
          const mappings = await db.query.flashcardTranslations.findMany({
            where: and(
              inArray(flashcardTranslations.baseFlashcardId, baseIds),
              eq(flashcardTranslations.targetLanguage, targetLanguage)
            ),
          });
          
          if (mappings.length > 0) {
            const translatedIds = mappings.map(m => m.translatedFlashcardId);
            const translatedManual = await db.query.flashcards.findMany({
              where: inArray(flashcards.id, translatedIds),
            });
            
            const baseIdOrder = new Map(baseIds.map((id, idx) => [id, idx]));
            const mappingByTranslated = new Map(mappings.map(m => [m.translatedFlashcardId, m.baseFlashcardId]));
            
            manualFlashcards = translatedManual.sort((a, b) => {
              const orderA = baseIdOrder.get(mappingByTranslated.get(a.id) || "") || 0;
              const orderB = baseIdOrder.get(mappingByTranslated.get(b.id) || "") || 0;
              return orderA - orderB;
            });
          }
        }
      }

      // Combine and deduplicate
      const allFlashcards = [...allGeneratedFlashcards, ...manualFlashcards];
      const seenIds = new Set<string>();
      const uniqueFlashcards = allFlashcards.filter(fc => {
        if (seenIds.has(fc.id)) return false;
        seenIds.add(fc.id);
        return true;
      });

      console.log(`[GET /api/flashcards/topic/:topicId/all] Returning ${uniqueFlashcards.length} flashcards in ${targetLanguage}`);

      return res.json({
        success: true,
        flashcards: uniqueFlashcards.map(fc => ({
          ...fc,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
        })),
        language: targetLanguage,
      });
    } catch (error) {
      console.error("Error fetching all topic flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards",
      });
    }
  });

  // Get ALL flashcards for a TOPIC (no translations - flashcards stay in their creation language)
  // Frontend displays flashcard in original language with language badge
  app.get("/api/flashcards/topic/:topicId/bundled", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.topicId;
      const cacheKey = `${topicId}:${userId}`;

      // Check cache first
      const cached = bundledFlashcardsCache.get(cacheKey);
      if (cached && cached.userId === userId && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        console.log(`[GET /api/flashcards/topic/:topicId/bundled] CACHE HIT for ${topicId}`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.json(cached.data);
      }

      console.log(`[GET /api/flashcards/topic/:topicId/bundled] topicId: ${topicId}`);

      // Verify topic belongs to user
      const topic = await db.query.topics.findFirst({
        where: eq(topics.id, topicId),
        with: { subject: true },
      });
      
      if (!topic || topic.subject?.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Tópico não encontrado",
        });
      }

      // Fetch ALL flashcards for this topic (auto-generated and manual, any language)
      const allFlashcards = await db.query.flashcards.findMany({
        where: eq(flashcards.topicId, topicId),
        orderBy: (fc, { asc }) => [asc(fc.createdAt)],
      });

      // Also fetch flashcards linked via topicSummaryId (auto-generated from summaries)
      const topicSummariesForFlashcards = await db.query.topicSummaries.findMany({
        where: eq(topicSummaries.topicId, topicId),
      });
      
      let summaryFlashcards: Flashcard[] = [];
      if (topicSummariesForFlashcards.length > 0) {
        const summaryIds = topicSummariesForFlashcards.map(s => s.id);
        summaryFlashcards = await db.query.flashcards.findMany({
          where: inArray(flashcards.topicSummaryId, summaryIds),
          orderBy: (fc, { asc }) => [asc(fc.createdAt)],
        });
      }

      // Combine and deduplicate
      const combined = [...allFlashcards, ...summaryFlashcards];
      const seenIds = new Set<string>();
      const uniqueFlashcards = combined.filter(fc => {
        if (seenIds.has(fc.id)) return false;
        seenIds.add(fc.id);
        return true;
      });

      if (uniqueFlashcards.length === 0) {
        return res.json({
          success: true,
          flashcards: [],
        });
      }

      // Fetch SM-2 attempts for all flashcards
      const allIds = uniqueFlashcards.map(fc => fc.id);
      const attemptsResult = await db.select()
        .from(flashcardAttempts)
        .where(
          and(
            inArray(flashcardAttempts.flashcardId, allIds),
            eq(flashcardAttempts.userId, userId)
          )
        )
        .orderBy(desc(flashcardAttempts.attemptDate));

      // Build attempts map - keep only latest attempt per flashcard
      const attemptsMap = new Map<string, { 
        nextReviewDate: Date | null; 
        easeFactor: number; 
        intervalDays: number;
        repetitions: number;
      }>();
      
      for (const attempt of attemptsResult) {
        if (!attemptsMap.has(attempt.flashcardId)) {
          attemptsMap.set(attempt.flashcardId, {
            nextReviewDate: attempt.nextReviewDate,
            easeFactor: attempt.easeFactor || 2.5,
            intervalDays: attempt.intervalDays || 0,
            repetitions: attempt.repetitions || 0,
          });
        }
      }

      // Build simple response - flashcards in their original creation language (no translations)
      const bundledFlashcards = uniqueFlashcards.map(fc => {
        const sm2Data = attemptsMap.get(fc.id);
        
        return {
          id: fc.id,
          topicId: fc.topicId,
          subjectId: fc.subjectId,
          isManual: fc.isManual,
          createdAt: fc.createdAt?.toISOString() || new Date().toISOString(),
          // Flashcard stays in its creation language
          language: fc.language,
          question: fc.question,
          answer: fc.answer,
          // SM-2 fields from attempts (real scheduling data)
          easeFactor: sm2Data?.easeFactor ?? 2.5,
          interval: sm2Data?.intervalDays ?? 0,
          repetitions: sm2Data?.repetitions ?? 0,
          nextReviewDate: sm2Data?.nextReviewDate?.toISOString() || null,
        };
      });

      console.log(`[GET /api/flashcards/topic/:topicId/bundled] Returning ${bundledFlashcards.length} flashcards`);

      const response = {
        success: true,
        flashcards: bundledFlashcards,
      };

      // Store in cache
      bundledFlashcardsCache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
        userId,
      });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.json(response);
    } catch (error) {
      console.error("Error fetching bundled flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards",
      });
    }
  });

  // Get DUE flashcards for a TOPIC - for Anki review (no translations - flashcards in creation language)
  app.get("/api/flashcards/topic/:topicId/due", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.topicId;

      console.log(`[GET /api/flashcards/topic/:topicId/due] topicId: ${topicId}`);

      // Verify topic belongs to user
      const topic = await db.query.topics.findFirst({
        where: eq(topics.id, topicId),
        with: { subject: true },
      });
      
      if (!topic || topic.subject?.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Tópico não encontrado",
        });
      }

      // Fetch ALL flashcards for this topic (any language - no translations)
      const allTopicFlashcards = await db.query.flashcards.findMany({
        where: eq(flashcards.topicId, topicId),
        orderBy: (fc, { asc }) => [asc(fc.createdAt)],
      });

      // Also fetch flashcards linked via topicSummaryId
      const topicSummariesList = await db.query.topicSummaries.findMany({
        where: eq(topicSummaries.topicId, topicId),
      });
      
      let summaryFlashcards: Flashcard[] = [];
      if (topicSummariesList.length > 0) {
        const summaryIds = topicSummariesList.map(s => s.id);
        summaryFlashcards = await db.query.flashcards.findMany({
          where: inArray(flashcards.topicSummaryId, summaryIds),
          orderBy: (fc, { asc }) => [asc(fc.createdAt)],
        });
      }

      // Combine and deduplicate
      const combined = [...allTopicFlashcards, ...summaryFlashcards];
      const seenIds = new Set<string>();
      const uniqueFlashcards = combined.filter(fc => {
        if (seenIds.has(fc.id)) return false;
        seenIds.add(fc.id);
        return true;
      });

      console.log(`[GET /api/flashcards/topic/:topicId/due] Found ${uniqueFlashcards.length} flashcards`);

      if (uniqueFlashcards.length === 0) {
        return res.json({
          success: true,
          flashcards: [],
          nextAvailableAt: null,
        });
      }

      const now = new Date();
      const flashcardIds = uniqueFlashcards.map(fc => fc.id);
      
      // Query attempts for all flashcards
      const attemptsMap = new Map<string, any>();
      if (flashcardIds.length > 0) {
        const attemptsResult = await db
          .select()
          .from(flashcardAttempts)
          .where(
            and(
              inArray(flashcardAttempts.flashcardId, flashcardIds),
              eq(flashcardAttempts.userId, userId)
            )
          )
          .orderBy(desc(flashcardAttempts.attemptDate));
        
        for (const attempt of attemptsResult) {
          if (!attemptsMap.has(attempt.flashcardId)) {
            attemptsMap.set(attempt.flashcardId, attempt);
          }
        }
      }

      // Filter due flashcards (no attempt OR nextReviewDate <= now)
      const dueFlashcards = uniqueFlashcards.filter(fc => {
        const attempt = attemptsMap.get(fc.id);
        if (!attempt) return true; // New flashcard without attempt
        return attempt.nextReviewDate && attempt.nextReviewDate <= now;
      });
      
      // Get next available review date
      const upcomingAttempts = Array.from(attemptsMap.values()).filter(
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
      });
    } catch (error) {
      console.error("Error fetching due topic flashcards:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar flashcards para revisão",
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

      // Verify user owns this flashcard
      // Manual flashcards have userId directly, AI-generated ones have summaryId/topicSummaryId
      if (flashcard.userId === userId) {
        // User owns this flashcard directly (manual flashcard)
        // Permission granted
      } else if (flashcard.summaryId) {
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
        return res.status(403).json({
          success: false,
          error: "Sem permissão para este flashcard",
        });
      }

      // Resolve base flashcard ID for progress sharing across languages
      const baseFlashcardId = await resolveBaseFlashcardId(flashcardId);
      const todayDate = new Date().toISOString().split('T')[0];
      const isCorrect = rating >= 3; // Rating 3-4 = correct, 1-2 = incorrect

      // Check if user has advanced flashcards (SM-2 algorithm)
      const hasAdvancedFlashcards = await subscriptionService.hasFeatureAccess(userId, 'advancedFlashcards');
      
      if (!hasAdvancedFlashcards) {
        // FREE plan: basic flashcards only (no SM-2 tracking)
        // Still record attempt for streak tracking, but no SM-2 scheduling
        await storage.createFlashcardAttempt({
          userId,
          flashcardId: baseFlashcardId,
          rating,
          attemptDate: new Date(),
          nextReviewDate: new Date(), // No scheduling
          easeFactor: 250,
          intervalDays: 0,
          repetitions: 0,
        });
        
        // Update daily metrics for streak tracking
        await storage.upsertFlashcardDailyMetrics(userId, todayDate, 1, isCorrect);
        
        // Award small XP for answering flashcard
        await awardXP(userId, "answer_flashcard", { rating, isCorrect });
        
        return res.json({
          success: true,
          message: "Resposta registada (plano FREE não tem repetição espaçada)",
          basicMode: true,
        });
      }

      // PRO/PREMIUM: Use SM-2 algorithm for spaced repetition
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

      // Update daily metrics for Anki-style statistics
      await storage.upsertFlashcardDailyMetrics(userId, todayDate, 1, isCorrect);
      
      // Award XP for answering flashcard
      await awardXP(userId, "answer_flashcard", { rating, isCorrect });

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

  // Get flashcard statistics (Anki-style KPIs)
  app.get("/api/flashcard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const daysBack = parseInt(req.query.days as string) || 365;
      
      const stats = await storage.getFlashcardStats(userId, daysBack);
      
      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Error fetching flashcard stats:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar estatísticas de flashcards",
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
          // Translate to all other languages - PARALLELIZED for speed
          const allLanguages: SupportedLanguage[] = ["pt", "en", "es", "fr", "de", "it"];
          const targetLanguages = allLanguages.filter(lang => lang !== baseLanguage);

          const translationService = await import("./translationService");
          const translationPromises = targetLanguages.map(async (targetLang) => {
            const translatedData = await translationService.translateFlashcardsText(
              [{ question: baseFlashcard.question, answer: baseFlashcard.answer }],
              baseLanguage,
              targetLang
            );
            return {
              language: targetLang,
              question: translatedData[0].question,
              answer: translatedData[0].answer,
            };
          });
          const translationsData = await Promise.all(translationPromises);

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

  // Complete missing translations for flashcards that have partial translations
  app.post("/api/admin/complete-translations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.body.topicId;
      console.log(`[COMPLETE-TRANS] Starting for user ${userId}, topic: ${topicId || 'all'}`);

      // Find PT base flashcards that are missing some translations
      const allLanguages: SupportedLanguage[] = ["pt", "en", "es", "fr", "de", "it"];
      const targetLanguages = allLanguages.filter(lang => lang !== "pt");

      // Get PT flashcards for this topic (including those linked via topic_summary_id)
      let ptFlashcards: Flashcard[] = [];
      
      if (topicId) {
        // Get direct topic flashcards
        const directFlashcards = await db.query.flashcards.findMany({
          where: and(
            eq(flashcards.userId, userId),
            eq(flashcards.language, "pt"),
            eq(flashcards.topicId, topicId)
          ),
        });
        
        // Get flashcards via topic summaries
        const topicSummaryList = await db.query.topicSummaries.findMany({
          where: and(
            eq(topicSummaries.topicId, topicId),
            eq(topicSummaries.language, "pt")
          ),
        });
        
        const summaryIds = topicSummaryList.map(s => s.id);
        let summaryFlashcards: Flashcard[] = [];
        if (summaryIds.length > 0) {
          summaryFlashcards = await db.query.flashcards.findMany({
            where: and(
              eq(flashcards.language, "pt"),
              inArray(flashcards.topicSummaryId, summaryIds)
            ),
          });
        }
        
        // Combine and deduplicate
        const seenIds = new Set<string>();
        for (const fc of [...directFlashcards, ...summaryFlashcards]) {
          if (!seenIds.has(fc.id)) {
            seenIds.add(fc.id);
            ptFlashcards.push(fc);
          }
        }
      } else {
        ptFlashcards = await db.query.flashcards.findMany({
          where: and(
            eq(flashcards.userId, userId),
            eq(flashcards.language, "pt")
          ),
        });
      }
      console.log(`[COMPLETE-TRANS] Found ${ptFlashcards.length} PT flashcards`);

      const results: { flashcardId: string; created: string[]; skipped: string[] }[] = [];
      const translationService = await import("./translationService");

      for (const baseFlashcard of ptFlashcards) {
        // Get existing translations for this flashcard
        const existingTranslations = await db
          .select()
          .from(flashcardTranslations)
          .where(eq(flashcardTranslations.baseFlashcardId, baseFlashcard.id));

        const existingLangs = new Set(existingTranslations.map(t => t.targetLanguage));
        const missingLangs = targetLanguages.filter(lang => !existingLangs.has(lang));

        if (missingLangs.length === 0) {
          continue; // All translations exist
        }

        console.log(`[COMPLETE-TRANS] Flashcard ${baseFlashcard.id} missing: ${missingLangs.join(', ')}`);

        try {
          // Translate to missing languages in parallel
          const translationPromises = missingLangs.map(async (targetLang) => {
            const translatedData = await translationService.translateFlashcardsText(
              [{ question: baseFlashcard.question, answer: baseFlashcard.answer }],
              "pt",
              targetLang
            );
            return {
              language: targetLang,
              question: translatedData[0].question,
              answer: translatedData[0].answer,
            };
          });
          const translationsData = await Promise.all(translationPromises);

          // Create translated flashcards and mappings
          await db.transaction(async (tx) => {
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

              await tx.insert(flashcardTranslations).values({
                baseFlashcardId: baseFlashcard.id,
                translatedFlashcardId: translatedFlashcard.id,
                targetLanguage: translation.language,
              });
            }
          });

          results.push({
            flashcardId: baseFlashcard.id,
            created: missingLangs,
            skipped: Array.from(existingLangs) as string[],
          });
        } catch (error) {
          console.error(`[COMPLETE-TRANS] Error for ${baseFlashcard.id}:`, error);
        }
      }

      // Clear bundled cache for this topic
      if (topicId) {
        bundledFlashcardsCache.delete(`${topicId}:${userId}`);
      }

      console.log(`[COMPLETE-TRANS] Completed. Created translations for ${results.length} flashcards`);
      return res.json({
        success: true,
        message: `Completed translations for ${results.length} flashcards`,
        results,
      });
    } catch (error) {
      console.error("[COMPLETE-TRANS] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to complete translations",
      });
    }
  });

  // ==================== CALENDAR EVENTS ROUTES (Premium Only) ====================

  // Get all calendar events for user
  app.get("/api/calendar/events", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const events = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.userId, userId))
        .orderBy(asc(calendarEvents.eventDate));

      return res.json({ success: true, events });
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch events" });
    }
  });

  // Create calendar event
  app.post("/api/calendar/events", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const validatedData = insertCalendarEventSchema.parse({
        ...req.body,
        userId,
      });

      // Validate subject ownership if provided
      if (validatedData.subjectId) {
        const [subject] = await db
          .select()
          .from(subjects)
          .where(and(eq(subjects.id, validatedData.subjectId), eq(subjects.userId, userId)));
        if (!subject) {
          return res.status(404).json({ success: false, errorCode: "SUBJECT_NOT_FOUND", error: "Subject not found" });
        }
      }

      // Validate topic ownership if provided
      if (validatedData.topicId) {
        const [topic] = await db
          .select()
          .from(topics)
          .where(and(eq(topics.id, validatedData.topicId), eq(topics.userId, userId)));
        if (!topic) {
          return res.status(404).json({ success: false, errorCode: "TOPIC_NOT_FOUND", error: "Topic not found" });
        }
      }

      const [newEvent] = await db
        .insert(calendarEvents)
        .values(validatedData)
        .returning();

      return res.json({ success: true, event: newEvent });
    } catch (error: any) {
      console.error("Error creating calendar event:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, error: "Invalid event data", details: error.errors });
      }
      return res.status(500).json({ success: false, error: "Failed to create event" });
    }
  });

  // Update calendar event
  app.patch("/api/calendar/events/:id", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;

      // Verify event ownership
      const [existingEvent] = await db
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));

      if (!existingEvent) {
        return res.status(404).json({ success: false, errorCode: "EVENT_NOT_FOUND", error: "Event not found" });
      }

      const updateData = insertCalendarEventSchema.partial().parse(req.body);

      // Validate subject ownership if being updated
      if (updateData.subjectId) {
        const [subject] = await db
          .select()
          .from(subjects)
          .where(and(eq(subjects.id, updateData.subjectId), eq(subjects.userId, userId)));
        if (!subject) {
          return res.status(404).json({ success: false, errorCode: "SUBJECT_NOT_FOUND", error: "Subject not found" });
        }
      }

      // Validate topic ownership if being updated
      if (updateData.topicId) {
        const [topic] = await db
          .select()
          .from(topics)
          .where(and(eq(topics.id, updateData.topicId), eq(topics.userId, userId)));
        if (!topic) {
          return res.status(404).json({ success: false, errorCode: "TOPIC_NOT_FOUND", error: "Topic not found" });
        }
      }

      const [updatedEvent] = await db
        .update(calendarEvents)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
        .returning();

      return res.json({ success: true, event: updatedEvent });
    } catch (error: any) {
      console.error("Error updating calendar event:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, error: "Invalid event data", details: error.errors });
      }
      return res.status(500).json({ success: false, error: "Failed to update event" });
    }
  });

  // Toggle event completion status
  app.patch("/api/calendar/events/:id/toggle", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;

      // Verify event ownership
      const [existingEvent] = await db
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));

      if (!existingEvent) {
        return res.status(404).json({ success: false, errorCode: "EVENT_NOT_FOUND", error: "Event not found" });
      }

      const [updatedEvent] = await db
        .update(calendarEvents)
        .set({ completed: !existingEvent.completed, updatedAt: new Date() })
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
        .returning();

      return res.json({ success: true, event: updatedEvent });
    } catch (error) {
      console.error("Error toggling event completion:", error);
      return res.status(500).json({ success: false, error: "Failed to toggle event" });
    }
  });

  // Delete calendar event
  app.delete("/api/calendar/events/:id", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;

      // Verify event ownership and delete
      const [deletedEvent] = await db
        .delete(calendarEvents)
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
        .returning();

      if (!deletedEvent) {
        return res.status(404).json({ success: false, errorCode: "EVENT_NOT_FOUND", error: "Event not found" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      return res.status(500).json({ success: false, error: "Failed to delete event" });
    }
  });

  // ============================================
  // SMART QUIZ ROUTES
  // ============================================

  // Generate quiz for a topic
  app.post("/api/quizzes/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const userLanguage = user?.language || "pt";

      const parseResult = generateQuizRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid request data",
          details: parseResult.error.errors 
        });
      }

      const { topicId, questionCount, difficulty } = parseResult.data;

      // Verify topic ownership
      const [topic] = await db
        .select()
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, userId)));

      if (!topic) {
        return res.status(404).json({ 
          success: false, 
          errorCode: "TOPIC_NOT_FOUND",
          error: "Topic not found" 
        });
      }

      // Get topic summaries for quiz generation
      const summaries = await db
        .select()
        .from(topicSummaries)
        .where(eq(topicSummaries.topicId, topicId));

      if (summaries.length === 0) {
        return res.status(400).json({ 
          success: false, 
          errorCode: "NO_SUMMARY",
          error: "This topic has no summaries. Generate a summary first." 
        });
      }

      // Combine summaries for quiz generation
      const combinedSummary = summaries.map(s => s.summary).join("\n\n");

      // Check for existing quiz in this language and difficulty
      const [existingQuiz] = await db
        .select()
        .from(quizzes)
        .where(and(
          eq(quizzes.topicId, topicId),
          eq(quizzes.userId, userId),
          eq(quizzes.language, userLanguage),
          eq(quizzes.difficulty, difficulty)
        ));

      if (existingQuiz) {
        // Return existing quiz with questions
        const questions = await db
          .select()
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, existingQuiz.id))
          .orderBy(asc(quizQuestions.position));

        return res.json({
          success: true,
          quiz: existingQuiz,
          questions: questions,
          isExisting: true,
        });
      }

      // Check monthly usage limit for quizzes
      const quizLimitCheck = await usageLimitsService.checkFeatureLimit(userId, "quizzes", userLanguage);
      if (!quizLimitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: quizLimitCheck.message,
          upgradeRequired: true,
        });
      }

      // Generate new quiz
      console.log("[Quiz] Generating quiz for topic:", topicId, { language: userLanguage, difficulty, questionCount });

      const generatedQuestions = await generateQuiz({
        summaryText: combinedSummary,
        language: userLanguage,
        difficulty: difficulty as "easy" | "medium" | "hard",
        questionCount: questionCount,
      });

      // Create quiz record
      const [newQuiz] = await db
        .insert(quizzes)
        .values({
          userId,
          topicId,
          title: topic.name,
          language: userLanguage,
          difficulty,
          questionCount: generatedQuestions.length,
        })
        .returning();

      // Create quiz questions
      const questionRecords = await Promise.all(
        generatedQuestions.map((q, index) =>
          db
            .insert(quizQuestions)
            .values({
              quizId: newQuiz.id,
              questionText: q.questionText,
              options: q.options,
              correctOptionId: q.correctOptionId,
              explanation: q.explanation,
              position: index,
            })
            .returning()
        )
      );

      const questions = questionRecords.map(r => r[0]);

      console.log("[Quiz] Quiz created successfully:", { quizId: newQuiz.id, questionCount: questions.length });

      // Record monthly usage for quizzes
      await usageLimitsService.recordUsage(userId, "quizzes", 1);

      return res.json({
        success: true,
        quiz: newQuiz,
        questions: questions,
        isExisting: false,
      });
    } catch (error) {
      console.error("Error generating quiz:", error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to generate quiz" 
      });
    }
  });

  // Get quiz by ID with questions
  app.get("/api/quizzes/:quizId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quizId } = req.params;

      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));

      if (!quiz) {
        return res.status(404).json({ 
          success: false, 
          errorCode: "QUIZ_NOT_FOUND",
          error: "Quiz not found" 
        });
      }

      const questions = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId))
        .orderBy(asc(quizQuestions.position));

      return res.json({
        success: true,
        quiz,
        questions,
      });
    } catch (error) {
      console.error("Error getting quiz:", error);
      return res.status(500).json({ success: false, error: "Failed to get quiz" });
    }
  });

  // Get quizzes for a topic
  app.get("/api/topics/:topicId/quizzes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId } = req.params;

      // Verify topic ownership
      const [topic] = await db
        .select()
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, userId)));

      if (!topic) {
        return res.status(404).json({ 
          success: false, 
          errorCode: "TOPIC_NOT_FOUND",
          error: "Topic not found" 
        });
      }

      const topicQuizzes = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.topicId, topicId), eq(quizzes.userId, userId)))
        .orderBy(desc(quizzes.createdAt));

      // Get latest attempt for each quiz
      const quizzesWithAttempts = await Promise.all(
        topicQuizzes.map(async (quiz) => {
          const [latestAttempt] = await db
            .select()
            .from(quizAttempts)
            .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, userId)))
            .orderBy(desc(quizAttempts.completedAt))
            .limit(1);

          return {
            ...quiz,
            lastAttempt: latestAttempt || null,
          };
        })
      );

      return res.json({
        success: true,
        quizzes: quizzesWithAttempts,
      });
    } catch (error) {
      console.error("Error getting topic quizzes:", error);
      return res.status(500).json({ success: false, error: "Failed to get quizzes" });
    }
  });

  // Submit quiz answers
  app.post("/api/quizzes/:quizId/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quizId } = req.params;

      const parseResult = submitQuizAnswersSchema.safeParse({ ...req.body, quizId });
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid submission data",
          details: parseResult.error.errors 
        });
      }

      const { answers, timeSpentSeconds } = parseResult.data;

      // Verify quiz ownership
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));

      if (!quiz) {
        return res.status(404).json({ 
          success: false, 
          errorCode: "QUIZ_NOT_FOUND",
          error: "Quiz not found" 
        });
      }

      // Get all questions
      const questions = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId));

      const questionMap = new Map(questions.map(q => [q.id, q]));

      // Calculate score
      let correctCount = 0;
      const results: any[] = [];

      for (const answer of answers) {
        const question = questionMap.get(answer.questionId);
        if (!question) continue;

        const isCorrect = answer.selectedOptionId === question.correctOptionId;
        if (isCorrect) correctCount++;

        results.push({
          questionId: question.id,
          questionText: question.questionText,
          selectedOptionId: answer.selectedOptionId,
          correctOptionId: question.correctOptionId,
          isCorrect,
          explanation: question.explanation,
          options: question.options,
        });
      }

      const totalQuestions = questions.length;
      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

      // Create attempt record
      const [attempt] = await db
        .insert(quizAttempts)
        .values({
          userId,
          quizId,
          score: correctCount,
          totalQuestions,
          percentage,
          timeSpentSeconds: timeSpentSeconds || null,
          completedAt: new Date(),
        })
        .returning();

      // Record individual answers
      await Promise.all(
        results.map((r) =>
          db.insert(quizQuestionAnswers).values({
            attemptId: attempt.id,
            questionId: r.questionId,
            selectedOptionId: r.selectedOptionId,
            isCorrect: r.isCorrect,
          })
        )
      );

      // Award XP for completing quiz
      await awardXP(userId, "complete_study_session");

      console.log("[Quiz] Quiz submitted:", { attemptId: attempt.id, score: correctCount, percentage });

      return res.json({
        success: true,
        attemptId: attempt.id,
        score: correctCount,
        totalQuestions,
        percentage,
        results,
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      return res.status(500).json({ success: false, error: "Failed to submit quiz" });
    }
  });

  // Get quiz attempt history
  app.get("/api/quizzes/:quizId/attempts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quizId } = req.params;

      const attempts = await db
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)))
        .orderBy(desc(quizAttempts.completedAt));

      return res.json({
        success: true,
        attempts,
      });
    } catch (error) {
      console.error("Error getting quiz attempts:", error);
      return res.status(500).json({ success: false, error: "Failed to get attempts" });
    }
  });

  // Delete quiz
  app.delete("/api/quizzes/:quizId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quizId } = req.params;

      const [deletedQuiz] = await db
        .delete(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
        .returning();

      if (!deletedQuiz) {
        return res.status(404).json({ 
          success: false, 
          errorCode: "QUIZ_NOT_FOUND",
          error: "Quiz not found" 
        });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting quiz:", error);
      return res.status(500).json({ success: false, error: "Failed to delete quiz" });
    }
  });

  // Regenerate quiz (delete existing and create new)
  app.post("/api/quizzes/:quizId/regenerate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quizId } = req.params;
      const user = await storage.getUser(userId);
      const userLanguage = user?.language || "pt";

      // Get existing quiz
      const [existingQuiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));

      if (!existingQuiz) {
        return res.status(404).json({ 
          success: false, 
          errorCode: "QUIZ_NOT_FOUND",
          error: "Quiz not found" 
        });
      }

      // Get topic summaries
      const summaries = await db
        .select()
        .from(topicSummaries)
        .where(eq(topicSummaries.topicId, existingQuiz.topicId));

      if (summaries.length === 0) {
        return res.status(400).json({ 
          success: false, 
          errorCode: "NO_SUMMARY",
          error: "No summaries available for regeneration" 
        });
      }

      const combinedSummary = summaries.map(s => s.summary).join("\n\n");

      // Check monthly usage limit for quizzes
      const quizLimitCheck = await usageLimitsService.checkFeatureLimit(userId, "quizzes", userLanguage);
      if (!quizLimitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: quizLimitCheck.message,
          upgradeRequired: true,
        });
      }

      // Generate new questions
      const generatedQuestions = await generateQuiz({
        summaryText: combinedSummary,
        language: userLanguage,
        difficulty: existingQuiz.difficulty as "easy" | "medium" | "hard",
        questionCount: existingQuiz.questionCount,
      });

      // Record monthly usage for quizzes
      await usageLimitsService.recordUsage(userId, "quizzes", 1);

      // Delete old questions
      await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));

      // Update quiz timestamp
      const [updatedQuiz] = await db
        .update(quizzes)
        .set({ 
          questionCount: generatedQuestions.length,
          updatedAt: new Date() 
        })
        .where(eq(quizzes.id, quizId))
        .returning();

      // Create new questions
      const questionRecords = await Promise.all(
        generatedQuestions.map((q, index) =>
          db
            .insert(quizQuestions)
            .values({
              quizId: quizId,
              questionText: q.questionText,
              options: q.options,
              correctOptionId: q.correctOptionId,
              explanation: q.explanation,
              position: index,
            })
            .returning()
        )
      );

      const questions = questionRecords.map(r => r[0]);

      return res.json({
        success: true,
        quiz: updatedQuiz,
        questions,
      });
    } catch (error) {
      console.error("Error regenerating quiz:", error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to regenerate quiz" 
      });
    }
  });

  registerOrganizationRoutes(app);
  registerChatRoutes(app);
  registerStatsRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
