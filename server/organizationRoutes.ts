import type { Express } from "express";
import multer from "multer";
import { z } from "zod";
import { db } from "./db";
import { subjects, topics, contentItems, contentAssets, contentLinks, insertSubjectSchema, insertTopicSchema, insertContentItemSchema, topicSummaries, learningStyles } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { isAuthenticated } from "./supabaseAuth";
import { extractTextFromFile, validateFileType, isValidFileSize } from "./textExtractor";
import { generateSummary } from "./openai";
import { awardXP } from "./gamificationService";
import { subscriptionService } from "./subscriptionService";
import { costControlService } from "./costControlService";
import { getUserLanguage } from "./languageHelper";
import { getOrCreateTranslatedSummary, getOrCreateTranslatedFlashcards } from "./translationService";
import { storage } from "./storage";
import type { SupportedLanguage } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max (plan-specific limits checked in route)
  },
  fileFilter: (req, file, cb) => {
    const validType = validateFileType(file.mimetype);
    if (validType) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de ficheiro não suportado. Use PDF, DOCX ou PPTX."));
    }
  },
});

async function aggregateTopicContent(topicId: string): Promise<string> {
  const contents = await db.query.contentItems.findMany({
    where: eq(contentItems.topicId, topicId),
    orderBy: [contentItems.createdAt],
  });

  if (contents.length === 0) {
    return "Este tópico ainda não tem conteúdo.";
  }

  let aggregatedText = "";
  const MAX_CHARS = 500000; // ~125k tokens aproximadamente (4 chars/token)
  let currentLength = 0;

  for (const content of contents) {
    const header = `\n\n### Fonte: ${content.title} (${content.contentType.toUpperCase()})\n\n`;
    
    if (currentLength + header.length > MAX_CHARS) {
      aggregatedText += "\n\n[... conteúdo adicional omitido devido ao limite de tamanho ...]";
      break;
    }

    aggregatedText += header;
    currentLength += header.length;

    if (content.contentType === "link" && content.metadata) {
      const metadata = content.metadata as any;
      const linkText = `URL: ${metadata.url}\n${metadata.description ? `Descrição: ${metadata.description}\n` : ''}`;
      
      if (currentLength + linkText.length > MAX_CHARS) {
        aggregatedText += "[... truncado ...]";
        break;
      }
      
      aggregatedText += linkText;
      currentLength += linkText.length;
    } else if (content.extractedText) {
      const availableSpace = MAX_CHARS - currentLength;
      
      if (content.extractedText.length > availableSpace) {
        aggregatedText += content.extractedText.substring(0, availableSpace) + "\n[... truncado ...]";
        break;
      }
      
      aggregatedText += content.extractedText;
      currentLength += content.extractedText.length;
    }
  }

  return aggregatedText.trim();
}

interface SummaryGenerationResult {
  overallSuccess: boolean;
  generatedStyles: string[];
  failedStyles: Array<{ style: string; reason: string }>;
  wordLimitReached: boolean;
}

async function generateTopicSummaries(
  topicId: string, 
  userId: string,
  specificStyle?: "visual" | "logico" | "conciso"
): Promise<SummaryGenerationResult> {
  try {
    let aggregatedContent = await aggregateTopicContent(topicId);

    if (aggregatedContent === "Este tópico ainda não tem conteúdo.") {
      console.log(`[TopicSummary] Topic ${topicId} has no content to summarize`);
      return {
        overallSuccess: false,
        generatedStyles: [],
        failedStyles: [{ style: "all", reason: "Tópico sem conteúdo" }],
        wordLimitReached: false,
      };
    }

    // INVISIBLE COST CONTROL: Get plan tier and apply limits silently
    const planTier = await costControlService.getUserPlanTier(userId);
    aggregatedContent = costControlService.trimInputText(aggregatedContent, planTier);

    // Always generate summaries in Portuguese (base language) for translation system
    // The translation system will handle displaying in user's language
    const baseLanguage = "pt";
    console.log(`[TopicSummary] Generating in base language: ${baseLanguage} (user lang: ${await getUserLanguage(userId)})`);

    // Get allowed learning styles for user's plan
    const subscription = await subscriptionService.getUserSubscription(userId);
    const planLimits = subscriptionService.getPlanLimits(subscription?.plan || "free");
    const allowedStyles = planLimits.allowedLearningStyles;

    // If a specific style is requested, generate only that one
    // Otherwise, generate all styles allowed by the user's plan
    const stylesToGenerate = specificStyle 
      ? [specificStyle] 
      : learningStyles.filter(style => allowedStyles.includes(style));

    const generatedStyles: string[] = [];
    const failedStyles: Array<{ style: string; reason: string }> = [];
    let wordLimitReached = false;

    // INVISIBLE COST CONTROL: Get plan-based depth modifier and token limits
    const depthModifier = costControlService.getSummaryDepthModifier(planTier, baseLanguage);
    const maxTokens = costControlService.getMaxCompletionTokens(planTier, "summary");

    for (const style of stylesToGenerate) {
      try {
        // Check and apply soft daily limits (delays, never blocks)
        const usageCheck = await costControlService.checkDailyUsage(userId, "summary", planTier);
        if (usageCheck.shouldDelay) {
          await costControlService.applyDelayIfNeeded(usageCheck.delayMs);
        }
        
        const result = await generateSummary({
          text: aggregatedContent,
          learningStyle: style,
          language: baseLanguage,
          depthModifier,
          maxCompletionTokens: maxTokens,
        });
        
        // Increment daily usage counter
        costControlService.incrementDailyUsage(userId, "summary");

        // Check word count limit before saving
        const wordCount = result.summary.split(/\s+/).length;
        const summaryCheck = await subscriptionService.canGenerateSummary(userId, wordCount);
        
        if (!summaryCheck.allowed) {
          console.log(`[TopicSummary] Summary for ${style} exceeds word limit: ${wordCount} words`);
          failedStyles.push({ style, reason: summaryCheck.reason || "Limite de palavras excedido" });
          wordLimitReached = true;
          continue;
        }

        await db.insert(topicSummaries)
          .values({
            topicId,
            learningStyle: style,
            language: baseLanguage,
            summary: result.summary,
            motivationalMessage: result.motivationalMessage,
          })
          .onConflictDoUpdate({
            target: [topicSummaries.topicId, topicSummaries.learningStyle, topicSummaries.language],
            set: {
              summary: result.summary,
              motivationalMessage: result.motivationalMessage,
              updatedAt: new Date(),
            },
          });

        generatedStyles.push(style);
        console.log(`[TopicSummary] Generated ${style} summary for topic ${topicId}`);
      } catch (styleError) {
        console.error(`[TopicSummary] Failed to generate ${style} summary:`, styleError);
        failedStyles.push({ 
          style, 
          reason: styleError instanceof Error ? styleError.message : "Erro desconhecido" 
        });
      }
    }

    if (generatedStyles.length > 0) {
      await awardXP(userId, "generate_summary");
    }

    return {
      overallSuccess: generatedStyles.length > 0,
      generatedStyles,
      failedStyles,
      wordLimitReached,
    };
  } catch (error) {
    console.error("[TopicSummary] Error generating topic summaries:", error);
    return {
      overallSuccess: false,
      generatedStyles: [],
      failedStyles: [{ style: "all", reason: "Erro ao gerar resumos" }],
      wordLimitReached: false,
    };
  }
}

export function registerOrganizationRoutes(app: Express) {
  app.get("/api/subjects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const userSubjects = await db.query.subjects.findMany({
        where: eq(subjects.userId, userId),
        orderBy: [subjects.position],
        with: {
          topics: {
            orderBy: [topics.position],
          },
        },
      });

      res.json({ success: true, subjects: userSubjects });
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar disciplinas" });
    }
  });

  app.post("/api/subjects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check subject limit
      const [{ count: currentCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(subjects)
        .where(eq(subjects.userId, userId));
      
      const limitCheck = await subscriptionService.canCreateSubject(userId, currentCount);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: limitCheck.reason,
          errorCode: limitCheck.errorCode,
          params: limitCheck.params,
          upgradeRequired: true,
        });
      }
      
      const validatedData = insertSubjectSchema.parse({
        ...req.body,
        userId,
      });

      const subject = await db.insert(subjects).values(validatedData).returning();

      res.json({ success: true, subject: subject[0] });
    } catch (error) {
      console.error("Error creating subject:", error);
      res.status(400).json({ success: false, error: "Erro ao criar disciplina" });
    }
  });

  // Handler for updating subjects (shared by PUT and PATCH)
  const updateSubjectHandler = async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const existing = await db.query.subjects.findFirst({
        where: and(eq(subjects.id, id), eq(subjects.userId, userId)),
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Disciplina não encontrada" });
      }

      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        color: z.string().length(7).optional(),
        position: z.number().int().optional(),
      }).strict();

      const validatedData = updateSchema.parse(req.body);

      const updated = await db
        .update(subjects)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(subjects.id, id))
        .returning();

      res.json({ success: true, subject: updated[0] });
    } catch (error) {
      console.error("Error updating subject:", error);
      res.status(400).json({ success: false, error: "Erro ao atualizar disciplina" });
    }
  };

  app.put("/api/subjects/:id", isAuthenticated, updateSubjectHandler);
  app.patch("/api/subjects/:id", isAuthenticated, updateSubjectHandler);

  app.delete("/api/subjects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const existing = await db.query.subjects.findFirst({
        where: and(eq(subjects.id, id), eq(subjects.userId, userId)),
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Disciplina não encontrada" });
      }

      await db.delete(subjects).where(eq(subjects.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting subject:", error);
      res.status(500).json({ success: false, error: "Erro ao eliminar disciplina" });
    }
  });

  app.get("/api/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subjectId } = req.query;

      const conditions = subjectId
        ? and(eq(topics.userId, userId), eq(topics.subjectId, subjectId as string))
        : eq(topics.userId, userId);

      const userTopics = await db.query.topics.findMany({
        where: conditions,
        orderBy: [topics.position],
        with: {
          subject: true,
        },
      });

      res.json({ success: true, topics: userTopics });
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar tópicos" });
    }
  });

  // Get single topic by ID
  app.get("/api/topics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, id), eq(topics.userId, userId)),
        with: {
          subject: true,
        },
      });

      if (!topic) {
        return res.status(404).json({ success: false, error: "Tópico não encontrado" });
      }

      res.json({ success: true, topic });
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar tópico" });
    }
  });

  app.post("/api/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const validatedData = insertTopicSchema.parse({
        ...req.body,
        userId,
      });

      const subject = await db.query.subjects.findFirst({
        where: and(eq(subjects.id, validatedData.subjectId), eq(subjects.userId, userId)),
      });

      if (!subject) {
        return res.status(403).json({ success: false, error: "Disciplina não encontrada ou sem permissão" });
      }

      // Check topic limit
      const [{ count: currentCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(topics)
        .where(eq(topics.userId, userId));
      
      const limitCheck = await subscriptionService.canCreateTopic(userId, currentCount);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: limitCheck.reason,
          errorCode: limitCheck.errorCode,
          params: limitCheck.params,
          upgradeRequired: true,
        });
      }

      const topic = await db.insert(topics).values(validatedData).returning();

      res.json({ success: true, topic: topic[0] });
    } catch (error) {
      console.error("Error creating topic:", error);
      res.status(400).json({ success: false, error: "Erro ao criar tópico" });
    }
  });

  // Handler for updating topics (shared by PUT and PATCH)
  const updateTopicHandler = async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const existing = await db.query.topics.findFirst({
        where: and(eq(topics.id, id), eq(topics.userId, userId)),
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Tópico não encontrado" });
      }

      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        position: z.number().int().optional(),
      }).strict();

      const validatedData = updateSchema.parse(req.body);

      const updated = await db
        .update(topics)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(topics.id, id))
        .returning();

      res.json({ success: true, topic: updated[0] });
    } catch (error) {
      console.error("Error updating topic:", error);
      res.status(400).json({ success: false, error: "Erro ao atualizar tópico" });
    }
  };

  app.put("/api/topics/:id", isAuthenticated, updateTopicHandler);
  app.patch("/api/topics/:id", isAuthenticated, updateTopicHandler);

  app.delete("/api/topics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const existing = await db.query.topics.findFirst({
        where: and(eq(topics.id, id), eq(topics.userId, userId)),
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Tópico não encontrado" });
      }

      await db.delete(topics).where(eq(topics.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting topic:", error);
      res.status(500).json({ success: false, error: "Erro ao eliminar tópico" });
    }
  });

  app.get("/api/content/:topicId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId } = req.params;

      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      });

      if (!topic) {
        return res.status(404).json({ success: false, error: "Tópico não encontrado" });
      }

      const content = await db.query.contentItems.findMany({
        where: eq(contentItems.topicId, topicId),
        orderBy: [desc(contentItems.createdAt)],
        with: {
          assets: true,
          links: true,
          summary: true,
        },
      });

      res.json({ success: true, content });
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar conteúdo" });
    }
  });

  app.post("/api/content/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId, title, generateAISummary } = req.body;

      if (!req.file) {
        return res.status(400).json({ success: false, error: "Nenhum ficheiro foi carregado" });
      }

      if (!topicId) {
        return res.status(400).json({ success: false, error: "topicId é obrigatório" });
      }

      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      });

      if (!topic) {
        return res.status(403).json({ success: false, error: "Tópico não encontrado ou sem permissão" });
      }

      // Check subscription upload limit
      const uploadCheck = await subscriptionService.canUpload(userId);
      if (!uploadCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: uploadCheck.reason,
          errorCode: uploadCheck.errorCode,
          params: uploadCheck.params,
          upgradeRequired: true,
        });
      }

      // Get user's subscription to check file size limits
      const subscription = await subscriptionService.getOrCreateSubscription(userId);
      const plan = subscription.plan as "free" | "pro" | "premium";

      const contentType = validateFileType(req.file.mimetype);
      if (!contentType) {
        return res.status(400).json({ success: false, error: "Tipo de ficheiro não suportado" });
      }

      if (!isValidFileSize(req.file.size, plan)) {
        const { getMaxFileSizeMB } = await import("./textExtractor");
        const maxSize = getMaxFileSizeMB(plan);
        return res.status(400).json({ 
          success: false, 
          error: `Ficheiro demasiado grande (máx ${maxSize}MB para o plano ${plan.toUpperCase()})` 
        });
      }

      const extracted = await extractTextFromFile(req.file.buffer, contentType, req.file.mimetype);

      // First create the content item (without summaryId)
      const contentItem = await db
        .insert(contentItems)
        .values({
          topicId,
          userId,
          contentType,
          title: title || req.file.originalname,
          extractedText: extracted.text,
          metadata: { ...extracted.metadata, originalFilename: req.file.originalname },
          summaryId: null, // We use contentSummaries table now
        })
        .returning();

      // Generate summaries for all 4 learning styles if requested
      if (generateAISummary === "true" && extracted.text && extracted.text.length > 50) {
        const words = extracted.text.split(/\s+/);
        const limitedText = words.slice(0, 1500).join(" ");
        const { storage } = await import("./storage");
        const { contentSummaries: contentSummariesTable } = await import("@shared/schema");
        
        const userLanguage = await getUserLanguage(userId);
        console.log(`[ContentUpload] Using language: ${userLanguage} for summaries`);
        
        // Generate all 4 summaries sequentially to avoid rate limits
        const learningStyles: Array<"visual" | "logico" | "conciso"> = ["visual", "logico", "conciso"];
        let successfulSummaries = 0;
        
        for (const style of learningStyles) {
          try {
            const { summary, motivationalMessage } = await generateSummary({
              text: limitedText,
              learningStyle: style,
              language: userLanguage,
            });

            const savedSummary = await storage.createSummary({
              userId,
              fileName: req.file.originalname,
              learningStyle: style,
              summary,
              motivationalMessage,
              isFavorite: false,
            });

            // Link summary to content item with error handling for unique constraint
            try {
              await db.insert(contentSummariesTable).values({
                contentItemId: contentItem[0].id,
                summaryId: savedSummary.id,
                learningStyle: style,
              });
              successfulSummaries++;
            } catch (insertError: any) {
              if (insertError.code === '23505') {
                console.warn(`Duplicate summary for style ${style}, skipping`);
              } else {
                throw insertError;
              }
            }
          } catch (styleError) {
            console.error(`Error generating ${style} summary:`, styleError);
            // Continue with other styles even if one fails
          }
        }

        // Only award XP if at least one summary was successfully created
        if (successfulSummaries > 0) {
          await awardXP(userId, "generate_summary", {
            fileName: req.file.originalname,
            stylesGenerated: successfulSummaries,
          });
        }
      }

      await db.insert(contentAssets).values({
        contentItemId: contentItem[0].id,
        storageKey: contentItem[0].id,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        pageCount: extracted.pageCount,
      });

      await awardXP(userId, "upload_pdf", { fileName: req.file.originalname });

      // Increment upload count only after all operations succeed
      await subscriptionService.incrementUploadCount(userId);

      res.json({ success: true, contentItem: contentItem[0] });
    } catch (error) {
      console.error("Error uploading content:", error);
      res.status(500).json({ 
        success: false, 
        error: "Upload failed",
        errorCode: "uploadFailed"
      });
    }
  });

  app.post("/api/content/link", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId, url, title, description } = req.body;

      if (!topicId || !url) {
        return res.status(400).json({ success: false, error: "topicId e url são obrigatórios" });
      }

      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      });

      if (!topic) {
        return res.status(403).json({ success: false, error: "Tópico não encontrado ou sem permissão" });
      }

      const contentItem = await db
        .insert(contentItems)
        .values({
          topicId,
          userId,
          contentType: "link",
          title: title || url,
          metadata: { url },
        })
        .returning();

      await db.insert(contentLinks).values({
        contentItemId: contentItem[0].id,
        url,
        title: title || null,
        description: description || null,
      });

      res.json({ success: true, contentItem: contentItem[0] });
    } catch (error) {
      console.error("Error adding link:", error);
      res.status(500).json({ success: false, error: "Erro ao adicionar link" });
    }
  });

  app.delete("/api/content/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const existing = await db.query.contentItems.findFirst({
        where: and(eq(contentItems.id, id), eq(contentItems.userId, userId)),
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Conteúdo não encontrado" });
      }

      await db.delete(contentItems).where(eq(contentItems.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ success: false, error: "Erro ao eliminar conteúdo" });
    }
  });

  // Generate summaries for a topic (manual trigger)
  app.post("/api/topics/:id/summaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { learningStyle } = req.body; // Optional: specific style to generate

      // Verify topic belongs to user
      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, id), eq(topics.userId, userId)),
      });

      if (!topic) {
        return res.status(404).json({ success: false, error: "Tópico não encontrado" });
      }

      // Check if learningStyle is allowed for this user's plan (if specified)
      if (learningStyle) {
        const styleCheck = await subscriptionService.canUseLearningStyle(userId, learningStyle);
        if (!styleCheck.allowed) {
          return res.status(403).json({
            success: false,
            error: styleCheck.reason,
            upgradeRequired: true,
          });
        }
      }

      const result = await generateTopicSummaries(id, userId, learningStyle);

      if (result.overallSuccess) {
        // Increment summary count after successful generation
        await subscriptionService.incrementSummaryCount(userId);
        
        if (result.failedStyles.length > 0) {
          // Partial success - some styles generated, some failed
          res.json({ 
            success: true, 
            message: "Alguns resumos foram gerados com sucesso",
            generatedStyles: result.generatedStyles,
            failedStyles: result.failedStyles,
          });
        } else {
          // Complete success
          res.json({ 
            success: true, 
            message: "Resumo gerado com sucesso",
            generatedStyles: result.generatedStyles,
          });
        }
      } else if (result.wordLimitReached) {
        // Word limit exceeded - subscription limit
        const errorMessage = result.failedStyles[0]?.reason || "Limite de palavras excedido";
        res.status(403).json({ 
          success: false, 
          error: errorMessage,
          upgradeRequired: true,
          failedStyles: result.failedStyles,
        });
      } else {
        // Other error
        const errorMessage = result.failedStyles[0]?.reason || "Não foi possível gerar resumo.";
        res.status(400).json({ 
          success: false, 
          error: errorMessage,
          failedStyles: result.failedStyles,
        });
      }
    } catch (error) {
      console.error("Error generating topic summaries:", error);
      res.status(500).json({ success: false, error: "Erro ao gerar resumo" });
    }
  });

  // Get all summaries for a topic (grouped by learning style)
  app.get("/api/topics/:id/summaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const requestedLanguage = req.query.language as string | undefined;

      // Get user to access language preference
      const user = await storage.getUser(userId);
      const targetLanguage: SupportedLanguage = requestedLanguage 
        ? getUserLanguage(requestedLanguage) 
        : getUserLanguage(user?.language);

      console.log(`[GET /api/topics/:id/summaries] Requested language: ${targetLanguage}`);

      // Verify topic belongs to user
      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, id), eq(topics.userId, userId)),
      });

      if (!topic) {
        return res.status(404).json({ success: false, error: "Tópico não encontrado" });
      }

      // Fetch Portuguese (base) summaries for this topic
      let baseSummaries = await db.query.topicSummaries.findMany({
        where: and(
          eq(topicSummaries.topicId, id),
          eq(topicSummaries.language, "pt")
        ),
      });

      console.log(`[GET /api/topics/:id/summaries] Found ${baseSummaries.length} Portuguese summaries`);

      // Fallback: If no Portuguese summaries exist, check for summaries in any language
      // This handles legacy summaries generated before the PT-first approach
      if (baseSummaries.length === 0) {
        console.log(`[GET /api/topics/:id/summaries] No PT summaries, checking for legacy summaries in any language...`);
        baseSummaries = await db.query.topicSummaries.findMany({
          where: eq(topicSummaries.topicId, id),
        });
        console.log(`[GET /api/topics/:id/summaries] Found ${baseSummaries.length} legacy summaries`);
      }

      // Get or create translations for each summary
      const summariesList = [];
      for (const baseSummary of baseSummaries) {
        try {
          // If the base summary is already in target language, use it directly
          if (baseSummary.language === targetLanguage) {
            summariesList.push(baseSummary);
          } else {
            // Only translate if base is PT (standard path)
            if (baseSummary.language === "pt") {
              const translatedSummary = await getOrCreateTranslatedSummary(baseSummary.id, targetLanguage);
              summariesList.push(translatedSummary);
            } else {
              // Legacy non-PT summary: return as-is (no translation available)
              console.log(`[GET /api/topics/:id/summaries] Using legacy ${baseSummary.language} summary as-is for ${baseSummary.learningStyle}`);
              summariesList.push(baseSummary);
            }
          }
        } catch (translationError) {
          console.error(`[GET /api/topics/:id/summaries] Failed to get/create translation for ${baseSummary.learningStyle}:`, translationError);
          // Fallback: return base summary even if translation fails
          summariesList.push(baseSummary);
        }
      }

      console.log(`[GET /api/topics/:id/summaries] Returning ${summariesList.length} summaries in ${targetLanguage}`);


      // Group by learning style for easy frontend consumption
      const summariesByStyle = summariesList.reduce((acc, item) => {
        acc[item.learningStyle] = {
          id: item.id,
          summary: item.summary,
          motivationalMessage: item.motivationalMessage,
          updatedAt: item.updatedAt,
          language: item.language,
        };
        return acc;
      }, {} as Record<string, any>);

      res.json({ 
        success: true, 
        summaries: summariesByStyle,
        count: summariesList.length,
        hasContent: summariesList.length > 0,
        language: targetLanguage,
      });
    } catch (error) {
      console.error("Error fetching topic summaries:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar resumos" });
    }
  });
}
