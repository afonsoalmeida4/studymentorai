import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { topicSummaries, flashcards, flashcardTranslations } from "@shared/schema";
import type { SupportedLanguage, TopicSummary, Flashcard } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Language names for prompts
const languageNameMap: Record<SupportedLanguage, string> = {
  pt: "Portuguese",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
};

/**
 * Get or create a translated topic summary.
 * Checks DB cache first, translates and persists if not found.
 * 
 * @param summaryId - ID of the original summary (any language)
 * @param targetLanguage - Target language code
 * @returns Translated summary from DB (cached or newly created)
 */
export async function getOrCreateTranslatedSummary(
  summaryId: string,
  targetLanguage: SupportedLanguage
): Promise<TopicSummary> {
  // 1. Fetch the original summary to get topicId and learningStyle
  const originalSummary = await db.query.topicSummaries.findFirst({
    where: eq(topicSummaries.id, summaryId),
  });

  if (!originalSummary) {
    throw new Error(`Summary ${summaryId} not found`);
  }

  // 2. Check if translated version already exists in DB
  const existingTranslation = await db.query.topicSummaries.findFirst({
    where: and(
      eq(topicSummaries.topicId, originalSummary.topicId),
      eq(topicSummaries.learningStyle, originalSummary.learningStyle),
      eq(topicSummaries.language, targetLanguage)
    ),
  });

  if (existingTranslation) {
    // Cache hit! Return existing translation
    console.log(`[Translation Cache HIT] Summary ${summaryId} -> ${targetLanguage}`);
    return existingTranslation;
  }

  // 3. Cache miss - need to translate
  console.log(`[Translation Cache MISS] Summary ${summaryId} -> ${targetLanguage} - translating...`);
  
  // Always translate from Portuguese (base language)
  const sourceLanguage: SupportedLanguage = "pt";
  
  // If original is not PT, fetch the PT version first
  let sourceSummary = originalSummary;
  if (originalSummary.language !== "pt") {
    const ptSummary = await db.query.topicSummaries.findFirst({
      where: and(
        eq(topicSummaries.topicId, originalSummary.topicId),
        eq(topicSummaries.learningStyle, originalSummary.learningStyle),
        eq(topicSummaries.language, "pt")
      ),
    });
    
    if (!ptSummary) {
      throw new Error(`Portuguese base summary not found for ${summaryId}`);
    }
    sourceSummary = ptSummary;
  }

  // 4. Translate via GPT-4
  const translated = await translateSummaryText(
    sourceSummary.summary,
    sourceSummary.motivationalMessage,
    sourceLanguage,
    targetLanguage
  );

  // 5. Persist translated summary to DB
  const [newSummary] = await db.insert(topicSummaries).values({
    topicId: originalSummary.topicId,
    learningStyle: originalSummary.learningStyle,
    language: targetLanguage,
    summary: translated.summary,
    motivationalMessage: translated.motivationalMessage,
  }).returning();

  console.log(`[Translation Cache STORED] Summary ${summaryId} -> ${targetLanguage} as ${newSummary.id}`);
  
  return newSummary;
}

/**
 * Get or create translated flashcards for a topic summary.
 * Checks DB cache first, translates and persists if not found.
 * 
 * @param topicSummaryId - ID of the topic summary (in any language)
 * @param targetLanguage - Target language code
 * @returns Array of translated flashcards from DB (cached or newly created)
 */
export async function getOrCreateTranslatedFlashcards(
  topicSummaryId: string,
  targetLanguage: SupportedLanguage
): Promise<Flashcard[]> {
  // 1. Fetch the original topic summary to get topic and learning style info
  const originalSummary = await db.query.topicSummaries.findFirst({
    where: eq(topicSummaries.id, topicSummaryId),
  });

  if (!originalSummary) {
    throw new Error(`Topic summary ${topicSummaryId} not found`);
  }

  // 2. Get or create the translated summary (needed for FK relationship)
  const translatedSummary = await getOrCreateTranslatedSummary(topicSummaryId, targetLanguage);

  // 3. Check if translated flashcards already exist in DB
  const existingFlashcards = await db.query.flashcards.findMany({
    where: and(
      eq(flashcards.topicSummaryId, translatedSummary.id),
      eq(flashcards.language, targetLanguage)
    ),
  });

  if (existingFlashcards.length > 0) {
    // Cache hit! Return existing translated flashcards
    console.log(`[Translation Cache HIT] ${existingFlashcards.length} flashcards for summary ${topicSummaryId} -> ${targetLanguage}`);
    return existingFlashcards;
  }

  // 4. Cache miss - need to translate flashcards
  console.log(`[Translation Cache MISS] Flashcards for summary ${topicSummaryId} -> ${targetLanguage} - translating...`);

  // Always translate from Portuguese (base language)
  const sourceLanguage: SupportedLanguage = "pt";
  
  // Fetch Portuguese flashcards
  const ptSummary = await db.query.topicSummaries.findFirst({
    where: and(
      eq(topicSummaries.topicId, originalSummary.topicId),
      eq(topicSummaries.learningStyle, originalSummary.learningStyle),
      eq(topicSummaries.language, "pt")
    ),
  });

  if (!ptSummary) {
    throw new Error(`Portuguese base summary not found for ${topicSummaryId}`);
  }

  const sourceFlashcards = await db.query.flashcards.findMany({
    where: and(
      eq(flashcards.topicSummaryId, ptSummary.id),
      eq(flashcards.language, "pt")
    ),
  });

  if (sourceFlashcards.length === 0) {
    // No flashcards to translate - return empty array
    return [];
  }

  // 5. Translate flashcards via GPT-4
  const flashcardsData = sourceFlashcards.map(fc => ({
    question: fc.question,
    answer: fc.answer,
  }));

  const translatedFlashcardsData = await translateFlashcardsText(
    flashcardsData,
    sourceLanguage,
    targetLanguage
  );

  // 6. Persist translated flashcards to DB
  const newFlashcards = await db.insert(flashcards).values(
    translatedFlashcardsData.map(fc => ({
      topicSummaryId: translatedSummary.id,
      language: targetLanguage,
      question: fc.question,
      answer: fc.answer,
    }))
  ).returning();

  // 7. Create flashcard translation mappings for SM-2 progress sharing
  if (targetLanguage !== "pt" && newFlashcards.length === sourceFlashcards.length) {
    const translationMappings = newFlashcards.map((translatedFC, index) => ({
      baseFlashcardId: sourceFlashcards[index].id, // PT flashcard (base)
      translatedFlashcardId: translatedFC.id,      // Translated flashcard
      targetLanguage,
    }));

    await db.insert(flashcardTranslations).values(translationMappings);
    console.log(`[Translation Mappings CREATED] ${translationMappings.length} mappings for ${targetLanguage}`);
  }

  console.log(`[Translation Cache STORED] ${newFlashcards.length} flashcards for summary ${topicSummaryId} -> ${targetLanguage}`);

  return newFlashcards;
}

/**
 * Internal: Translate summary text using GPT-4 (no DB interaction)
 */
async function translateSummaryText(
  summary: string,
  motivationalMessage: string,
  fromLanguage: SupportedLanguage,
  toLanguage: SupportedLanguage
): Promise<{ summary: string; motivationalMessage: string }> {
  if (fromLanguage === toLanguage) {
    return { summary, motivationalMessage };
  }

  const fromLangName = languageNameMap[fromLanguage];
  const toLangName = languageNameMap[toLanguage];

  const prompt = `You are a professional translator. Translate the following study summary and motivational message from ${fromLangName} to ${toLangName}.

IMPORTANT:
- Preserve all formatting (line breaks, bullet points, structure)
- Keep technical terms accurate
- Make the translation natural and contextually appropriate
- Maintain the same tone and style

SUMMARY TO TRANSLATE:
${summary}

MOTIVATIONAL MESSAGE TO TRANSLATE:
${motivationalMessage}

Respond ONLY with a JSON object in this exact format:
{
  "summary": "translated summary here",
  "motivationalMessage": "translated motivational message here"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Always respond with valid JSON only, no additional text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No translation response from OpenAI");
    }

    const translated = JSON.parse(content);
    
    if (!translated.summary || !translated.motivationalMessage) {
      throw new Error("Invalid translation response format");
    }

    return {
      summary: translated.summary,
      motivationalMessage: translated.motivationalMessage,
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error(`Failed to translate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Internal: Translate flashcards text using GPT-4 (no DB interaction)
 */
async function translateFlashcardsText(
  flashcards: Array<{ question: string; answer: string }>,
  fromLanguage: SupportedLanguage,
  toLanguage: SupportedLanguage
): Promise<Array<{ question: string; answer: string }>> {
  if (fromLanguage === toLanguage) {
    return flashcards;
  }

  if (flashcards.length === 0) {
    return [];
  }

  const fromLangName = languageNameMap[fromLanguage];
  const toLangName = languageNameMap[toLanguage];

  const flashcardsText = flashcards
    .map((fc, i) => `Flashcard ${i + 1}:\nQuestion: ${fc.question}\nAnswer: ${fc.answer}`)
    .join("\n\n");

  const prompt = `You are a professional translator. Translate the following flashcards from ${fromLangName} to ${toLangName}.

IMPORTANT:
- Preserve the educational content and accuracy
- Keep technical terms correct in the target language
- Make questions and answers natural in the target language
- Maintain the same level of difficulty

FLASHCARDS TO TRANSLATE:
${flashcardsText}

Respond ONLY with a JSON object in this exact format:
{
  "flashcards": [
    {"question": "translated question 1", "answer": "translated answer 1"},
    {"question": "translated question 2", "answer": "translated answer 2"},
    ...
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional translator specializing in educational content. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No translation response from OpenAI");
    }

    const translated = JSON.parse(content);
    
    if (!Array.isArray(translated.flashcards)) {
      throw new Error("Invalid flashcards translation response format");
    }

    // Validate we got the same number of flashcards back
    if (translated.flashcards.length !== flashcards.length) {
      console.warn(`Translation returned ${translated.flashcards.length} flashcards but expected ${flashcards.length}`);
    }

    return translated.flashcards;
  } catch (error) {
    console.error("Flashcard translation error:", error);
    throw new Error(`Failed to translate flashcards: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
