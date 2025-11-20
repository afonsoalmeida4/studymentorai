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
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const data = await pdfParse(buffer);
  
  return {
    text: data.text.trim(),
    pageCount: data.numpages,
    metadata: {
      info: data.info,
      version: data.version,
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

export function isValidFileSize(sizeBytes: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes <= maxSizeBytes;
}
