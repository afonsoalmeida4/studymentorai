import mammoth from "mammoth";
import officeParser from "officeparser";
import { ContentType } from "@shared/schema";

export interface ExtractedContent {
  text: string;
  pageCount?: number;
  metadata?: Record<string, unknown>;
}

export async function extractTextFromFile(
  buffer: Buffer,
  contentType: ContentType,
  mimeType: string
): Promise<ExtractedContent> {
  try {
    switch (contentType) {
      case "pdf":
        return await extractFromPDF(buffer);
      case "docx":
        return await extractFromDOCX(buffer);
      case "pptx":
        return await extractFromPPTX(buffer);
      default:
        throw new Error(`Tipo de conteúdo não suportado: ${contentType}`);
    }
  } catch (error) {
    console.error(`Erro ao extrair texto de ${contentType}:`, error);
    throw new Error(`Falha ao processar ficheiro ${contentType}`);
  }
}

async function extractFromPDF(buffer: Buffer): Promise<ExtractedContent> {
  const { PDFParse } = await import("pdf-parse");
  
  // Convert Buffer to Uint8Array for pdf-parse v2
  const uint8Array = new Uint8Array(buffer);
  
  const pdfParser = new PDFParse({ data: uint8Array });
  
  // Use getText() - the v2 API method
  const result = await pdfParser.getText();
  
  // Clean up parser resources
  await pdfParser.destroy();
  
  // result.text contains the extracted text
  // Filter out page markers like "-- 1 of 4 --" that getText() sometimes includes
  let extractedText = result.text || "";
  
  // Remove page marker lines (e.g., "-- 1 of 4 --", "-- Page 1 --")
  extractedText = extractedText
    .split('\n')
    .filter(line => !line.match(/^--\s*\d+\s*(of|de)\s*\d+\s*--$/i))
    .filter(line => !line.match(/^--\s*Page\s*\d+\s*--$/i))
    .join('\n')
    .trim();
  
  // Type assertion to access properties not in TypeScript types
  const resultAny = result as any;
  
  return {
    text: extractedText,
    pageCount: resultAny.numpages,
    metadata: {
      extracted: true,
      info: resultAny.info,
    },
  };
}

async function extractFromDOCX(buffer: Buffer): Promise<ExtractedContent> {
  const result = await mammoth.extractRawText({ buffer });
  
  return {
    text: result.value.trim(),
    metadata: {
      messages: result.messages,
    },
  };
}

async function extractFromPPTX(buffer: Buffer): Promise<ExtractedContent> {
  const text = await officeParser.parseOfficeAsync(buffer);
  
  return {
    text: (text || "").trim(),
    metadata: {
      extracted: true,
    },
  };
}

export function validateFileType(mimetype: string): ContentType | null {
  const mimeToContentType: Record<string, ContentType> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  };

  return mimeToContentType[mimetype] || null;
}

export function isValidFileSize(sizeBytes: number, plan: "free" | "pro" | "premium" = "free"): boolean {
  // FREE: 10MB limit
  // PRO/PREMIUM: No limit (100MB practical limit)
  const maxSizeMB = plan === "free" ? 10 : 100;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes <= maxSizeBytes;
}

export function getMaxFileSizeMB(plan: "free" | "pro" | "premium" = "free"): number {
  return plan === "free" ? 10 : 100;
}
