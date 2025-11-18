import OpenAI from "openai";
import type { SupportedLanguage } from "@shared/schema";

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
 * Translate a topic summary to a target language using GPT-4
 */
export async function translateTopicSummary(
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
 * Translate flashcards to a target language using GPT-4
 */
export async function translateFlashcards(
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
