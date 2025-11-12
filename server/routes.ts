import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { generateSummary } from "./openai";
import { generateSummaryRequestSchema, type GenerateSummaryResponse, type Summary } from "@shared/schema";
import { randomUUID } from "crypto";

// Configure multer for file upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
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
  // PDF Upload and Summary Generation Endpoint
  app.post("/api/generate-summary", upload.single("pdf"), async (req, res) => {
    try {
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
        // Dynamic import for CommonJS module
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const pdfData = await pdfParse(req.file.buffer);
        pdfText = pdfData.text;

        if (!pdfText || pdfText.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: "O PDF não contém texto extraível",
          } as GenerateSummaryResponse);
        }

        // Limit text length to avoid token limits (approximately 15000 words ~ 20000 tokens)
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

        const summaryResult: Summary = {
          id: randomUUID(),
          fileName: req.file.originalname,
          learningStyle,
          summary,
          motivationalMessage,
          createdAt: new Date().toISOString(),
        };

        return res.json({
          success: true,
          summary: summaryResult,
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

  const httpServer = createServer(app);
  return httpServer;
}
