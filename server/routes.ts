import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { generateSummary, generateFlashcards } from "./openai";
import { 
  generateSummaryRequestSchema, 
  generateFlashcardsRequestSchema,
  type GenerateSummaryResponse,
  type GenerateFlashcardsResponse,
} from "@shared/schema";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

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
        const parser = new PDFParse();
        const pdfData = await parser.parse(req.file.buffer);
        pdfText = pdfData.text;

        if (!pdfText || pdfText.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: "O PDF não contém texto extraível",
          } as GenerateSummaryResponse);
        }

        // Limit text length to avoid token limits
        const words = pdfText.split(/\s+/);
        if (words.length > 15000) {
          pdfText = words.slice(0, 15000).join(" ");
        }
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

  const httpServer = createServer(app);
  return httpServer;
}
