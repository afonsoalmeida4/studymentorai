import type { Express } from "express";
import multer from "multer";
import { z } from "zod";
import { db } from "./db";
import { subjects, topics, contentItems, contentAssets, contentLinks, insertSubjectSchema, insertTopicSchema, insertContentItemSchema, topicSummaries, learningStyles } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isAuthenticated } from "./replitAuth";
import { extractTextFromFile, validateFileType, isValidFileSize } from "./textExtractor";
import { generateSummary } from "./openai";
import { awardXP } from "./gamificationService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
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

  for (const content of contents) {
    aggregatedText += `\n\n### Fonte: ${content.title} (${content.contentType.toUpperCase()})\n\n`;

    if (content.contentType === "link" && content.metadata) {
      const metadata = content.metadata as any;
      aggregatedText += `URL: ${metadata.url}\n`;
      if (metadata.description) {
        aggregatedText += `Descrição: ${metadata.description}\n`;
      }
    } else if (content.extractedText) {
      aggregatedText += content.extractedText;
    }
  }

  return aggregatedText.trim();
}

async function generateTopicSummaries(topicId: string, userId: string): Promise<boolean> {
  try {
    const aggregatedContent = await aggregateTopicContent(topicId);

    if (aggregatedContent === "Este tópico ainda não tem conteúdo.") {
      console.log(`[TopicSummary] Topic ${topicId} has no content to summarize`);
      return false;
    }

    console.log(`[TopicSummary] Generating summaries for topic ${topicId}, content length: ${aggregatedContent.length}`);

    let successCount = 0;

    for (const style of learningStyles) {
      try {
        const result = await generateSummary({
          text: aggregatedContent,
          learningStyle: style,
        });

        await db.insert(topicSummaries)
          .values({
            topicId,
            learningStyle: style,
            summary: result.summary,
            motivationalMessage: result.motivationalMessage,
          })
          .onConflictDoUpdate({
            target: [topicSummaries.topicId, topicSummaries.learningStyle],
            set: {
              summary: result.summary,
              motivationalMessage: result.motivationalMessage,
              updatedAt: new Date(),
            },
          });

        successCount++;
        console.log(`[TopicSummary] Generated ${style} summary for topic ${topicId}`);
      } catch (styleError) {
        console.error(`[TopicSummary] Failed to generate ${style} summary:`, styleError);
      }
    }

    if (successCount > 0) {
      await awardXP(userId, "generate_summary");
      return true;
    }

    return false;
  } catch (error) {
    console.error("[TopicSummary] Error generating topic summaries:", error);
    return false;
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

  app.put("/api/subjects/:id", isAuthenticated, async (req: any, res) => {
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
        description: z.string().optional(),
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
  });

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

      const topic = await db.insert(topics).values(validatedData).returning();

      res.json({ success: true, topic: topic[0] });
    } catch (error) {
      console.error("Error creating topic:", error);
      res.status(400).json({ success: false, error: "Erro ao criar tópico" });
    }
  });

  app.put("/api/topics/:id", isAuthenticated, async (req: any, res) => {
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
        description: z.string().optional(),
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
  });

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

      const contentType = validateFileType(req.file.mimetype);
      if (!contentType) {
        return res.status(400).json({ success: false, error: "Tipo de ficheiro não suportado" });
      }

      if (!isValidFileSize(req.file.size)) {
        return res.status(400).json({ success: false, error: "Ficheiro demasiado grande (máx 10MB)" });
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
        
        // Generate all 4 summaries sequentially to avoid rate limits
        const learningStyles: Array<"visual" | "auditivo" | "logico" | "conciso"> = ["visual", "auditivo", "logico", "conciso"];
        let successfulSummaries = 0;
        
        for (const style of learningStyles) {
          try {
            const { summary, motivationalMessage } = await generateSummary({
              text: limitedText,
              learningStyle: style,
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

      res.json({ success: true, contentItem: contentItem[0] });
    } catch (error) {
      console.error("Error uploading content:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar ficheiro" });
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

  // Get all summaries for a content item (grouped by learning style)
  app.get("/api/content/:contentItemId/summaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentItemId } = req.params;

      // Verify content item belongs to user
      const content = await db.query.contentItems.findFirst({
        where: and(eq(contentItems.id, contentItemId), eq(contentItems.userId, userId)),
      });

      if (!content) {
        return res.status(404).json({ success: false, error: "Conteúdo não encontrado" });
      }

      // Fetch all summaries for this content item
      const { contentSummaries: contentSummariesTable } = await import("@shared/schema");
      const summariesWithDetails = await db.query.contentSummaries.findMany({
        where: eq(contentSummariesTable.contentItemId, contentItemId),
        with: {
          summary: true,
        },
      });

      // Group by learning style for easy frontend consumption
      const summariesByStyle = summariesWithDetails.reduce((acc, item) => {
        acc[item.learningStyle] = item.summary;
        return acc;
      }, {} as Record<string, any>);

      res.json({ 
        success: true, 
        summaries: summariesByStyle,
        count: summariesWithDetails.length,
      });
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ success: false, error: "Erro ao carregar resumos" });
    }
  });
}
