import OpenAI from "openai";
import { normalizeLanguage } from "./languageHelper";

// This is using OpenAI's API, which points to OpenAI's API servers and requires your own API key.
// The newest OpenAI model is "gpt-5" which was released August 7, 2025. Do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 120 second timeout (2 minutes) for longer content
  maxRetries: 3, // Retry 3 times on temporary failures
});

export interface GenerateSummaryParams {
  text: string;
  learningStyle: "visual" | "logico" | "conciso";
  language?: string;
  depthModifier?: string;  // Plan-based depth modifier (appended to system prompt)
  maxCompletionTokens?: number;  // Plan-based token limit
}

export interface SummaryResult {
  summary: string;
  motivationalMessage: string;
}

export interface FlashcardItem {
  question: string;
  answer: string;
}

const learningStylePrompts: Record<string, Record<string, string>> = {
  pt: {
    visual: `Tutor visual: crie resumo com metáforas visuais, organize em estruturas claras (blocos, fluxos), sugira diagramas quando útil. Use linguagem que evoca imagens mentais. RESPONDA EM PORTUGUÊS.`,
    logico: `Tutor lógico: organize em passos sequenciais numerados, destaque causa e efeito, apresente raciocínio analítico e padrões. RESPONDA EM PORTUGUÊS.`,
    conciso: `Tutor objetivo: resumo direto aos pontos-chave, frases curtas, elimine redundância, apresente apenas o essencial. RESPONDA EM PORTUGUÊS.`,
  },
  en: {
    visual: `Visual tutor: create summary with visual metaphors, organize in clear structures (blocks, flows), suggest diagrams when useful. Use language that evokes mental images. RESPOND IN ENGLISH.`,
    logico: `Logical tutor: organize in numbered sequential steps, highlight cause and effect, present analytical reasoning and patterns. RESPOND IN ENGLISH.`,
    conciso: `Objective tutor: direct summary to key points, short sentences, eliminate redundancy, present only the essential. RESPOND IN ENGLISH.`,
  },
  es: {
    visual: `Tutor visual: cree resumen con metáforas visuales, organice en estructuras claras (bloques, flujos), sugiera diagramas cuando sea útil. Use lenguaje que evoque imágenes mentales. RESPONDA EN ESPAÑOL.`,
    logico: `Tutor lógico: organice en pasos secuenciales numerados, destaque causa y efecto, presente razonamiento analítico y patrones. RESPONDA EN ESPAÑOL.`,
    conciso: `Tutor objetivo: resumen directo a los puntos clave, frases cortas, elimine redundancia, presente solo lo esencial. RESPONDA EN ESPAÑOL.`,
  },
  fr: {
    visual: `Tuteur visuel : créez un résumé avec des métaphores visuelles, organisez en structures claires (blocs, flux), suggérez des diagrammes si utile. Utilisez un langage qui évoque des images mentales. RÉPONDEZ EN FRANÇAIS.`,
    logico: `Tuteur logique : organisez en étapes séquentielles numérotées, mettez en évidence la cause et l'effet, présentez un raisonnement analytique et des modèles. RÉPONDEZ EN FRANÇAIS.`,
    conciso: `Tuteur objectif : résumé direct aux points clés, phrases courtes, éliminez la redondance, présentez seulement l'essentiel. RÉPONDEZ EN FRANÇAIS.`,
  },
  de: {
    visual: `Visueller Tutor: Erstellen Sie eine Zusammenfassung mit visuellen Metaphern, organisieren Sie in klaren Strukturen (Blöcke, Flüsse), schlagen Sie Diagramme vor, wenn nützlich. Verwenden Sie Sprache, die mentale Bilder hervorruft. ANTWORTEN SIE AUF DEUTSCH.`,
    logico: `Logischer Tutor: Organisieren Sie in nummerierten sequentiellen Schritten, heben Sie Ursache und Wirkung hervor, präsentieren Sie analytisches Denken und Muster. ANTWORTEN SIE AUF DEUTSCH.`,
    conciso: `Objektiver Tutor: direkte Zusammenfassung zu den Hauptpunkten, kurze Sätze, eliminieren Sie Redundanz, präsentieren Sie nur das Wesentliche. ANTWORTEN SIE AUF DEUTSCH.`,
  },
  it: {
    visual: `Tutor visivo: crea riassunto con metafore visive, organizza in strutture chiare (blocchi, flussi), suggerisci diagrammi quando utile. Usa linguaggio che evoca immagini mentali. RISPONDI IN ITALIANO.`,
    logico: `Tutor logico: organizza in passi sequenziali numerati, evidenzia causa ed effetto, presenta ragionamento analitico e pattern. RISPONDI IN ITALIANO.`,
    conciso: `Tutor obiettivo: riassunto diretto ai punti chiave, frasi brevi, elimina ridondanza, presenta solo l'essenziale. RISPONDI IN ITALIANO.`,
  },
};

const motivationalPrompts: Record<string, Record<string, string>> = {
  pt: {
    visual: "Crie uma mensagem motivacional curta (1-2 frases) que use linguagem visual e inspire o estudante a imaginar o seu sucesso. RESPONDA EM PORTUGUÊS.",
    logico: "Crie uma mensagem motivacional curta (1-2 frases) que apresente uma lógica inspiradora sobre o progresso do estudante. RESPONDA EM PORTUGUÊS.",
    conciso: "Crie uma mensagem motivacional curta (1 frase) poderosa e direta que motive ação imediata. RESPONDA EM PORTUGUÊS.",
  },
  en: {
    visual: "Create a short motivational message (1-2 sentences) that uses visual language and inspires the student to imagine their success. RESPOND IN ENGLISH.",
    logico: "Create a short motivational message (1-2 sentences) that presents inspiring logic about the student's progress. RESPOND IN ENGLISH.",
    conciso: "Create a short motivational message (1 sentence) powerful and direct that motivates immediate action. RESPOND IN ENGLISH.",
  },
  es: {
    visual: "Cree un mensaje motivacional corto (1-2 frases) que use lenguaje visual e inspire al estudiante a imaginar su éxito. RESPONDA EN ESPAÑOL.",
    logico: "Cree un mensaje motivacional corto (1-2 frases) que presente una lógica inspiradora sobre el progreso del estudiante. RESPONDA EN ESPAÑOL.",
    conciso: "Cree un mensaje motivacional corto (1 frase) poderoso y directo que motive acción inmediata. RESPONDA EN ESPAÑOL.",
  },
  fr: {
    visual: "Créez un court message motivationnel (1-2 phrases) qui utilise un langage visuel et inspire l'étudiant à imaginer son succès. RÉPONDEZ EN FRANÇAIS.",
    logico: "Créez un court message motivationnel (1-2 phrases) qui présente une logique inspirante sur les progrès de l'étudiant. RÉPONDEZ EN FRANÇAIS.",
    conciso: "Créez un court message motivationnel (1 phrase) puissant et direct qui motive une action immédiate. RÉPONDEZ EN FRANÇAIS.",
  },
  de: {
    visual: "Erstellen Sie eine kurze motivierende Nachricht (1-2 Sätze), die visuelle Sprache verwendet und den Schüler inspiriert, sich seinen Erfolg vorzustellen. ANTWORTEN SIE AUF DEUTSCH.",
    logico: "Erstellen Sie eine kurze motivierende Nachricht (1-2 Sätze), die inspirierende Logik über den Fortschritt des Schülers präsentiert. ANTWORTEN SIE AUF DEUTSCH.",
    conciso: "Erstellen Sie eine kurze motivierende Nachricht (1 Satz), die kraftvoll und direkt ist und zu sofortigem Handeln motiviert. ANTWORTEN SIE AUF DEUTSCH.",
  },
  it: {
    visual: "Crea un breve messaggio motivazionale (1-2 frasi) che usa linguaggio visivo e ispira lo studente a immaginare il proprio successo. RISPONDI IN ITALIANO.",
    logico: "Crea un breve messaggio motivazionale (1-2 frasi) che presenti una logica ispiratrice sul progresso dello studente. RISPONDI IN ITALIANO.",
    conciso: "Crea un breve messaggio motivazionale (1 frase) potente e diretto che motivi azione immediata. RISPONDI IN ITALIANO.",
  },
};

// Function to generate flashcard system prompts based on limit
function getFlashcardSystemPrompt(lang: string, maxCards: number | null, existingQuestions: string[] = []): string {
  const isUnlimited = maxCards === null;
  const hasExisting = existingQuestions.length > 0;
  
  const limitInstructions: Record<string, { limited: string; unlimited: string }> = {
    pt: {
      limited: `Gere no máximo ${maxCards} flashcards.`,
      unlimited: `Gere flashcards para TODOS os conceitos, definições, fatos e informações importantes do texto. Cubra toda a matéria de forma abrangente. Não há limite - crie quantos flashcards forem necessários para cobrir todo o conteúdo.`,
    },
    en: {
      limited: `Generate at most ${maxCards} flashcards.`,
      unlimited: `Generate flashcards for ALL concepts, definitions, facts and important information in the text. Cover all the material comprehensively. There is no limit - create as many flashcards as needed to cover all the content.`,
    },
    es: {
      limited: `Genera como máximo ${maxCards} flashcards.`,
      unlimited: `Genera flashcards para TODOS los conceptos, definiciones, hechos e información importante del texto. Cubre toda la materia de forma integral. No hay límite - crea tantas flashcards como sean necesarias para cubrir todo el contenido.`,
    },
    fr: {
      limited: `Générez au maximum ${maxCards} flashcards.`,
      unlimited: `Générez des flashcards pour TOUS les concepts, définitions, faits et informations importantes du texte. Couvrez toute la matière de manière exhaustive. Il n'y a pas de limite - créez autant de flashcards que nécessaire pour couvrir tout le contenu.`,
    },
    de: {
      limited: `Generieren Sie maximal ${maxCards} Lernkarten.`,
      unlimited: `Generieren Sie Lernkarten für ALLE Konzepte, Definitionen, Fakten und wichtige Informationen im Text. Decken Sie den gesamten Stoff umfassend ab. Es gibt kein Limit - erstellen Sie so viele Lernkarten wie nötig, um den gesamten Inhalt abzudecken.`,
    },
    it: {
      limited: `Genera al massimo ${maxCards} flashcard.`,
      unlimited: `Genera flashcard per TUTTI i concetti, definizioni, fatti e informazioni importanti del testo. Copri tutta la materia in modo completo. Non c'è limite - crea quante flashcard siano necessarie per coprire tutto il contenuto.`,
    },
  };

  // Duplicate avoidance instructions
  const duplicateInstructions: Record<string, string> = {
    pt: `IMPORTANTE: Já existem flashcards para este conteúdo. NÃO cries perguntas iguais ou muito semelhantes às seguintes:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nCria APENAS flashcards com perguntas DIFERENTES que testem outros aspectos do conteúdo. Se todo o conteúdo relevante já está coberto, retorna um array JSON vazio: []`,
    en: `IMPORTANT: Flashcards already exist for this content. DO NOT create questions identical or very similar to the following:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nCreate ONLY flashcards with DIFFERENT questions that test other aspects of the content. If all relevant content is already covered, return an empty JSON array: []`,
    es: `IMPORTANTE: Ya existen flashcards para este contenido. NO crees preguntas iguales o muy similares a las siguientes:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nCrea SOLO flashcards con preguntas DIFERENTES que prueben otros aspectos del contenido. Si todo el contenido relevante ya está cubierto, devuelve un array JSON vacío: []`,
    fr: `IMPORTANT: Des flashcards existent déjà pour ce contenu. NE créez PAS de questions identiques ou très similaires aux suivantes:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nCréez UNIQUEMENT des flashcards avec des questions DIFFÉRENTES qui testent d'autres aspects du contenu. Si tout le contenu pertinent est déjà couvert, retournez un tableau JSON vide: []`,
    de: `WICHTIG: Für diesen Inhalt existieren bereits Lernkarten. Erstellen Sie KEINE Fragen, die identisch oder sehr ähnlich zu den folgenden sind:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nErstellen Sie NUR Lernkarten mit VERSCHIEDENEN Fragen, die andere Aspekte des Inhalts testen. Wenn alle relevanten Inhalte bereits abgedeckt sind, geben Sie ein leeres JSON-Array zurück: []`,
    it: `IMPORTANTE: Esistono già flashcard per questo contenuto. NON creare domande identiche o molto simili alle seguenti:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nCrea SOLO flashcard con domande DIVERSE che testino altri aspetti del contenuto. Se tutto il contenuto rilevante è già coperto, restituisci un array JSON vuoto: []`,
  };

  const instructions = limitInstructions[lang] || limitInstructions["pt"];
  const limitText = isUnlimited ? instructions.unlimited : instructions.limited;
  const duplicateText = hasExisting ? `\n\n${duplicateInstructions[lang] || duplicateInstructions["pt"]}` : "";

  const basePrompts: Record<string, string> = {
    pt: `Você é um especialista em educação que cria flashcards eficazes para estudo.
Crie flashcards com perguntas claras e respostas concisas baseadas no texto fornecido.
Cada flashcard deve testar um conceito-chave ou fato importante.
${limitText}

Retorne a resposta APENAS como um array JSON válido no seguinte formato:
[
  {"question": "Pergunta aqui?", "answer": "Resposta concisa aqui"},
  {"question": "Outra pergunta?", "answer": "Outra resposta"}
]

NÃO inclua nenhum texto adicional, markdown, ou explicações. APENAS o array JSON.
RESPONDA EM PORTUGUÊS.`,
    en: `You are an education expert who creates effective flashcards for studying.
Create flashcards with clear questions and concise answers based on the provided text.
Each flashcard should test a key concept or important fact.
${limitText}

Return the response ONLY as a valid JSON array in the following format:
[
  {"question": "Question here?", "answer": "Concise answer here"},
  {"question": "Another question?", "answer": "Another answer"}
]

DO NOT include any additional text, markdown, or explanations. ONLY the JSON array.
RESPOND IN ENGLISH.`,
    es: `Eres un experto en educación que crea flashcards efectivas para estudiar.
Crea flashcards con preguntas claras y respuestas concisas basadas en el texto proporcionado.
Cada flashcard debe probar un concepto clave o hecho importante.
${limitText}

Devuelve la respuesta SOLO como un array JSON válido en el siguiente formato:
[
  {"question": "¿Pregunta aquí?", "answer": "Respuesta concisa aquí"},
  {"question": "¿Otra pregunta?", "answer": "Otra respuesta"}
]

NO incluyas ningún texto adicional, markdown o explicaciones. SOLO el array JSON.
RESPONDE EN ESPAÑOL.`,
    fr: `Vous êtes un expert en éducation qui crée des flashcards efficaces pour étudier.
Créez des flashcards avec des questions claires et des réponses concises basées sur le texte fourni.
Chaque flashcard doit tester un concept clé ou un fait important.
${limitText}

Retournez la réponse UNIQUEMENT sous forme de tableau JSON valide dans le format suivant :
[
  {"question": "Question ici ?", "answer": "Réponse concise ici"},
  {"question": "Autre question ?", "answer": "Autre réponse"}
]

N'incluez AUCUN texte supplémentaire, markdown ou explications. UNIQUEMENT le tableau JSON.
RÉPONDEZ EN FRANÇAIS.`,
    de: `Sie sind ein Bildungsexperte, der effektive Lernkarten zum Lernen erstellt.
Erstellen Sie Lernkarten mit klaren Fragen und prägnanten Antworten basierend auf dem bereitgestellten Text.
Jede Lernkarte sollte ein Schlüsselkonzept oder eine wichtige Tatsache testen.
${limitText}

Geben Sie die Antwort NUR als gültiges JSON-Array im folgenden Format zurück:
[
  {"question": "Frage hier?", "answer": "Prägnante Antwort hier"},
  {"question": "Andere Frage?", "answer": "Andere Antwort"}
]

Fügen Sie KEINEN zusätzlichen Text, Markdown oder Erklärungen hinzu. NUR das JSON-Array.
ANTWORTEN SIE AUF DEUTSCH.`,
    it: `Sei un esperto di educazione che crea flashcard efficaci per studiare.
Crea flashcard con domande chiare e risposte concise basate sul testo fornito.
Ogni flashcard dovrebbe testare un concetto chiave o un fatto importante.
${limitText}

Restituisci la risposta SOLO come un array JSON valido nel seguente formato:
[
  {"question": "Domanda qui?", "answer": "Risposta concisa qui"},
  {"question": "Altra domanda?", "answer": "Altra risposta"}
]

NON includere alcun testo aggiuntivo, markdown o spiegazioni. SOLO l'array JSON.
RISPONDI IN ITALIANO.`,
  };

  const basePrompt = basePrompts[lang] || basePrompts["pt"];
  return basePrompt + duplicateText;
}

const flashcardUserPrompts: Record<string, string> = {
  pt: "Crie flashcards baseados neste resumo:",
  en: "Create flashcards based on this summary:",
  es: "Crea flashcards basadas en este resumen:",
  fr: "Créez des flashcards basées sur ce résumé :",
  de: "Erstellen Sie Lernkarten basierend auf dieser Zusammenfassung:",
  it: "Crea flashcard basate su questo riassunto:",
};

const flashcardErrorMessages: Record<string, { invalidFormat: string; invalidArray: string; noValidCards: string; generalError: string }> = {
  pt: {
    invalidFormat: "Formato de resposta inválido da IA",
    invalidArray: "A resposta da IA não é um array de flashcards",
    noValidCards: "Nenhum flashcard válido foi gerado. Por favor, tente novamente.",
    generalError: "Falha ao gerar flashcards. Por favor, tente novamente.",
  },
  en: {
    invalidFormat: "Invalid AI response format",
    invalidArray: "AI response is not a flashcard array",
    noValidCards: "No valid flashcards were generated. Please try again.",
    generalError: "Failed to generate flashcards. Please try again.",
  },
  es: {
    invalidFormat: "Formato de respuesta de IA inválido",
    invalidArray: "La respuesta de IA no es un array de flashcards",
    noValidCards: "No se generaron flashcards válidas. Por favor, inténtalo de nuevo.",
    generalError: "Error al generar flashcards. Por favor, inténtalo de nuevo.",
  },
  fr: {
    invalidFormat: "Format de réponse IA invalide",
    invalidArray: "La réponse IA n'est pas un tableau de flashcards",
    noValidCards: "Aucune flashcard valide n'a été générée. Veuillez réessayer.",
    generalError: "Échec de la génération de flashcards. Veuillez réessayer.",
  },
  de: {
    invalidFormat: "Ungültiges KI-Antwortformat",
    invalidArray: "KI-Antwort ist kein Lernkarten-Array",
    noValidCards: "Es wurden keine gültigen Lernkarten generiert. Bitte versuchen Sie es erneut.",
    generalError: "Fehler beim Generieren von Lernkarten. Bitte versuchen Sie es erneut.",
  },
  it: {
    invalidFormat: "Formato di risposta IA non valido",
    invalidArray: "La risposta IA non è un array di flashcard",
    noValidCards: "Nessuna flashcard valida è stata generata. Per favore riprova.",
    generalError: "Errore nella generazione di flashcard. Per favore riprova.",
  },
};

export async function generateSummary({
  text,
  learningStyle,
  language = "pt",
  depthModifier = "",
  maxCompletionTokens = 8192,
}: GenerateSummaryParams): Promise<SummaryResult> {
  try {
    const lang = normalizeLanguage(language, "pt");
    const baseSystemPrompt = learningStylePrompts[lang]?.[learningStyle] || learningStylePrompts["pt"][learningStyle];
    const systemPrompt = baseSystemPrompt + depthModifier; // Append plan-based depth modifier
    const motivationalPrompt = motivationalPrompts[lang]?.[learningStyle] || motivationalPrompts["pt"][learningStyle];

    const userPrompts: Record<string, string> = {
      pt: `Por favor, crie um resumo do seguinte texto adaptado ao estilo de aprendizagem especificado:\n\n${text}`,
      en: `Please create a summary of the following text adapted to the specified learning style:\n\n${text}`,
      es: `Por favor, cree un resumen del siguiente texto adaptado al estilo de aprendizaje especificado:\n\n${text}`,
      fr: `Veuillez créer un résumé du texte suivant adapté au style d'apprentissage spécifié:\n\n${text}`,
      de: `Bitte erstellen Sie eine Zusammenfassung des folgenden Textes, angepasst an den angegebenen Lernstil:\n\n${text}`,
      it: `Per favore, crea un riassunto del seguente testo adattato allo stile di apprendimento specificato:\n\n${text}`,
    };

    // Generate the summary with plan-based token limit
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompts[lang] || userPrompts["pt"],
        },
      ],
      max_completion_tokens: maxCompletionTokens,
    });

    console.log(`[OpenAI] Summary generation for ${learningStyle} style:`, {
      hasContent: !!summaryResponse.choices[0]?.message?.content,
      contentLength: summaryResponse.choices[0]?.message?.content?.length || 0,
      finishReason: summaryResponse.choices[0]?.finish_reason,
      usage: summaryResponse.usage,
      inputTextLength: text.length,
      promptLength: systemPrompt.length,
    });

    const defaultSummaryMessages: Record<string, string> = {
      pt: "Não foi possível gerar o resumo.",
      en: "Could not generate summary.",
      es: "No se pudo generar el resumen.",
      fr: "Impossible de générer le résumé.",
      de: "Zusammenfassung konnte nicht erstellt werden.",
      it: "Impossibile generare il riassunto.",
    };

    const summary = summaryResponse.choices[0].message.content || defaultSummaryMessages[lang] || defaultSummaryMessages["pt"];

    const motivationalUserPrompts: Record<string, string> = {
      pt: "Gere uma mensagem motivacional para um estudante que acabou de receber este resumo.",
      en: "Generate a motivational message for a student who just received this summary.",
      es: "Genere un mensaje motivacional para un estudiante que acaba de recibir este resumen.",
      fr: "Générez un message motivationnel pour un étudiant qui vient de recevoir ce résumé.",
      de: "Generieren Sie eine motivierende Nachricht für einen Schüler, der gerade diese Zusammenfassung erhalten hat.",
      it: "Genera un messaggio motivazionale per uno studente che ha appena ricevuto questo riassunto.",
    };

    const defaultMotivationalMessages: Record<string, string> = {
      pt: "Continue estudando e alcançará seus objetivos!",
      en: "Keep studying and you will achieve your goals!",
      es: "¡Sigue estudiando y alcanzarás tus objetivos!",
      fr: "Continuez à étudier et vous atteindrez vos objectifs !",
      de: "Lernen Sie weiter und Sie werden Ihre Ziele erreichen!",
      it: "Continua a studiare e raggiungerai i tuoi obiettivi!",
    };

    // Generate motivational message
    const motivationalResponse = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: motivationalPrompt,
        },
        {
          role: "user",
          content: motivationalUserPrompts[lang] || motivationalUserPrompts["pt"],
        },
      ],
      max_completion_tokens: 150,
    });

    const motivationalMessage = motivationalResponse.choices[0].message.content || defaultMotivationalMessages[lang] || defaultMotivationalMessages["pt"];

    return {
      summary,
      motivationalMessage,
    };
  } catch (error) {
    console.error("Error generating summary with GPT-5:", error);
    throw new Error("Falha ao gerar resumo. Por favor, tente novamente.");
  }
}

export async function generateFlashcards(
  summaryText: string, 
  language: string = "pt", 
  maxCards: number | null = 10,
  maxCompletionTokens: number = 4096,
  existingQuestions: string[] = []
): Promise<FlashcardItem[]> {
  try {
    const lang = normalizeLanguage(language, "pt");
    const systemPrompt = getFlashcardSystemPrompt(lang, maxCards, existingQuestions);
    const userPrompt = flashcardUserPrompts[lang] || flashcardUserPrompts["pt"];
    const errors = flashcardErrorMessages[lang] || flashcardErrorMessages["pt"];
    
    console.log(`[generateFlashcards] Avoiding ${existingQuestions.length} existing questions`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `${userPrompt}\n\n${summaryText}`,
        },
      ],
      max_completion_tokens: maxCompletionTokens,
    }, {
      timeout: 120000, // 2 minute timeout for flashcard generation
    });
    
    console.log("[generateFlashcards] GPT response status:", response.choices[0].finish_reason);
    console.log("[generateFlashcards] GPT response model:", response.model);

    const content = response.choices[0].message.content || "[]";
    
    console.log("[generateFlashcards] Raw content length:", content.length);
    console.log("[generateFlashcards] Raw content preview:", content.substring(0, 200));
    
    // Try to parse JSON, handling potential markdown code blocks
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/```\n?/g, "");
    }
    
    console.log("[generateFlashcards] Cleaned content preview:", cleanedContent.substring(0, 200));
    
    // Parse the JSON response
    let flashcards;
    try {
      flashcards = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse flashcards JSON:", parseError);
      console.error("Content received:", content.substring(0, 500));
      throw new Error(errors.invalidFormat);
    }
    
    console.log("[generateFlashcards] Parsed flashcards count:", Array.isArray(flashcards) ? flashcards.length : "not an array");
    if (Array.isArray(flashcards) && flashcards.length > 0) {
      console.log("[generateFlashcards] First flashcard:", JSON.stringify(flashcards[0]));
    }
    
    // Validate the structure
    if (!Array.isArray(flashcards)) {
      console.error("Response is not an array:", flashcards);
      throw new Error(errors.invalidArray);
    }
    
    // Ensure each flashcard has question and answer
    const validFlashcards = flashcards.filter(
      (fc) => fc && fc.question && fc.answer && typeof fc.question === "string" && typeof fc.answer === "string"
    );
    
    console.log("[generateFlashcards] Valid flashcards:", validFlashcards.length, "out of", flashcards.length);
    
    if (validFlashcards.length === 0) {
      // If we had existing questions and got 0 new ones, content is fully covered - return empty array (not an error)
      if (existingQuestions.length > 0) {
        console.log("[generateFlashcards] All content already covered by existing flashcards - returning empty array");
        return [];
      }
      // No existing questions but still got 0 flashcards - this is an actual error
      console.error("No valid flashcards after filtering. Total received:", flashcards.length);
      if (flashcards.length > 0) {
        console.error("Sample invalid flashcard:", JSON.stringify(flashcards[0]));
      }
      throw new Error(errors.noValidCards);
    }
    
    return validFlashcards;
  } catch (error) {
    console.error("Error generating flashcards with GPT-5:", error);
    if (error instanceof Error) {
      // Re-throw errors with localized messages
      const lang = language || "pt";
      const errors = flashcardErrorMessages[lang] || flashcardErrorMessages["pt"];
      const localizedErrors = Object.values(errors);
      if (localizedErrors.some(msg => error.message.includes(msg))) {
        throw error;
      }
    }
    const lang = language || "pt";
    const errors = flashcardErrorMessages[lang] || flashcardErrorMessages["pt"];
    throw new Error(errors.generalError);
  }
}

export interface StudyHistoryItem {
  fileName: string;
  summaryId: string;
  lastStudied: string;
  accuracy: number;
  studySessions: number;
}

export interface ReviewPlanResult {
  recommendations: string;
  priorityTopics: Array<{
    fileName: string;
    summaryId: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export async function generateReviewPlan(
  studyHistory: StudyHistoryItem[]
): Promise<ReviewPlanResult> {
  try {
    const systemPrompt = `Você é um especialista em pedagogia e repetição espaçada. 
Analise o histórico de estudo do utilizador e crie um plano de revisão personalizado.

Considere:
- Tópicos com baixa precisão (accuracy) precisam de revisão urgente
- Tópicos estudados há mais tempo precisam de revisão para retenção
- Distribua as revisões de forma equilibrada
- Use princípios de repetição espaçada (spaced repetition)

Forneça recomendações práticas e motivadoras.`;

    const historyText = studyHistory.length > 0
      ? studyHistory.map((item, index) => 
          `${index + 1}. ${item.fileName}
   - Última sessão: ${item.lastStudied}
   - Precisão: ${item.accuracy.toFixed(1)}%
   - Número de sessões: ${item.studySessions}`
        ).join('\n\n')
      : "Nenhum histórico de estudo disponível.";

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Analise este histórico de estudo e crie um plano de revisão personalizado:\n\n${historyText}\n\nRetorne sua resposta em formato JSON com a seguinte estrutura:
{
  "recommendations": "Texto com recomendações gerais",
  "priorityTopics": [
    {
      "fileName": "nome do ficheiro",
      "reason": "razão para revisar",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Limite a 5 tópicos prioritários. Seja específico e motivador.`,
        },
      ],
      max_completion_tokens: 1500,
    });

    const content = response.choices[0].message.content || "{}";
    
    // Try to parse JSON, handling potential markdown code blocks
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/```\n?/g, "");
    }
    
    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a safe fallback
      return {
        recommendations: "Não foi possível gerar um plano de revisão personalizado. Continue a estudar regularmente!",
        priorityTopics: [],
      };
    }
    
    // Validate and enrich the result
    if (!result.recommendations || !Array.isArray(result.priorityTopics)) {
      console.error("Invalid AI response structure:", result);
      return {
        recommendations: result.recommendations || "Continue o excelente trabalho nos seus estudos!",
        priorityTopics: [],
      };
    }

    // Match priority topics with summaryIds from study history
    const enrichedTopics = result.priorityTopics
      .filter((topic: any) => topic && topic.fileName && topic.reason && topic.priority) // Filter out invalid topics
      .map((topic: any) => {
        const historyItem = studyHistory.find(h => 
          h.fileName.toLowerCase().includes(topic.fileName.toLowerCase()) ||
          topic.fileName.toLowerCase().includes(h.fileName.toLowerCase())
        );
        
        return {
          fileName: topic.fileName,
          summaryId: historyItem?.summaryId || '',
          reason: topic.reason,
          priority: topic.priority,
        };
      })
      .filter((topic: any) => topic.summaryId); // Only keep topics we can match

    return {
      recommendations: result.recommendations,
      priorityTopics: enrichedTopics,
    };
  } catch (error) {
    console.error("Error generating review plan with GPT-5:", error);
    // Return a safe fallback instead of throwing
    return {
      recommendations: "Não foi possível gerar um plano de revisão neste momento. Continue a estudar regularmente!",
      priorityTopics: [],
    };
  }
}

// ============================================
// SMART QUIZ GENERATION
// ============================================

export interface QuizQuestionItem {
  questionText: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

const quizSystemPrompts: Record<string, Record<string, string>> = {
  pt: {
    easy: `És um professor especializado em criar quizzes educacionais de nível FÁCIL.
Cria perguntas de escolha múltipla simples e diretas que testam conceitos básicos.
As perguntas devem ser claras e ter uma resposta obviamente correta.
RESPONDE SEMPRE EM PORTUGUÊS.`,
    medium: `És um professor especializado em criar quizzes educacionais de nível MÉDIO.
Cria perguntas de escolha múltipla que testam compreensão e aplicação de conceitos.
As opções erradas devem ser plausíveis mas distinguíveis da correta.
RESPONDE SEMPRE EM PORTUGUÊS.`,
    hard: `És um professor especializado em criar quizzes educacionais de nível DIFÍCIL.
Cria perguntas de escolha múltipla que testam análise, síntese e pensamento crítico.
As opções devem ser desafiadoras, com distinções sutis entre as respostas.
RESPONDE SEMPRE EM PORTUGUÊS.`,
  },
  en: {
    easy: `You are a teacher specialized in creating EASY level educational quizzes.
Create simple and straightforward multiple choice questions that test basic concepts.
Questions should be clear with an obviously correct answer.
ALWAYS RESPOND IN ENGLISH.`,
    medium: `You are a teacher specialized in creating MEDIUM level educational quizzes.
Create multiple choice questions that test understanding and application of concepts.
Wrong options should be plausible but distinguishable from the correct one.
ALWAYS RESPOND IN ENGLISH.`,
    hard: `You are a teacher specialized in creating HARD level educational quizzes.
Create multiple choice questions that test analysis, synthesis and critical thinking.
Options should be challenging with subtle distinctions between answers.
ALWAYS RESPOND IN ENGLISH.`,
  },
  es: {
    easy: `Eres un profesor especializado en crear quizzes educativos de nivel FÁCIL.
Crea preguntas de opción múltiple simples y directas que prueben conceptos básicos.
Las preguntas deben ser claras con una respuesta obviamente correcta.
RESPONDE SIEMPRE EN ESPAÑOL.`,
    medium: `Eres un profesor especializado en crear quizzes educativos de nivel MEDIO.
Crea preguntas de opción múltiple que prueben comprensión y aplicación de conceptos.
Las opciones incorrectas deben ser plausibles pero distinguibles de la correcta.
RESPONDE SIEMPRE EN ESPAÑOL.`,
    hard: `Eres un profesor especializado en crear quizzes educativos de nivel DIFÍCIL.
Crea preguntas de opción múltiple que prueben análisis, síntesis y pensamiento crítico.
Las opciones deben ser desafiantes con distinciones sutiles entre respuestas.
RESPONDE SIEMPRE EN ESPAÑOL.`,
  },
  fr: {
    easy: `Tu es un professeur spécialisé dans la création de quiz éducatifs de niveau FACILE.
Crée des questions à choix multiples simples et directes qui testent les concepts de base.
Les questions doivent être claires avec une réponse évidemment correcte.
RÉPONDS TOUJOURS EN FRANÇAIS.`,
    medium: `Tu es un professeur spécialisé dans la création de quiz éducatifs de niveau MOYEN.
Crée des questions à choix multiples qui testent la compréhension et l'application des concepts.
Les mauvaises options doivent être plausibles mais distinguables de la bonne.
RÉPONDS TOUJOURS EN FRANÇAIS.`,
    hard: `Tu es un professeur spécialisé dans la création de quiz éducatifs de niveau DIFFICILE.
Crée des questions à choix multiples qui testent l'analyse, la synthèse et la pensée critique.
Les options doivent être difficiles avec des distinctions subtiles entre les réponses.
RÉPONDS TOUJOURS EN FRANÇAIS.`,
  },
  de: {
    easy: `Du bist ein Lehrer, der auf die Erstellung von EINFACHEN Bildungsquizzen spezialisiert ist.
Erstelle einfache und unkomplizierte Multiple-Choice-Fragen, die Grundkonzepte testen.
Fragen sollten klar sein mit einer offensichtlich richtigen Antwort.
ANTWORTE IMMER AUF DEUTSCH.`,
    medium: `Du bist ein Lehrer, der auf die Erstellung von MITTELSCHWEREN Bildungsquizzen spezialisiert ist.
Erstelle Multiple-Choice-Fragen, die Verständnis und Anwendung von Konzepten testen.
Falsche Optionen sollten plausibel, aber von der richtigen unterscheidbar sein.
ANTWORTE IMMER AUF DEUTSCH.`,
    hard: `Du bist ein Lehrer, der auf die Erstellung von SCHWIERIGEN Bildungsquizzen spezialisiert ist.
Erstelle Multiple-Choice-Fragen, die Analyse, Synthese und kritisches Denken testen.
Optionen sollten herausfordernd sein mit subtilen Unterscheidungen zwischen Antworten.
ANTWORTE IMMER AUF DEUTSCH.`,
  },
  it: {
    easy: `Sei un insegnante specializzato nella creazione di quiz educativi di livello FACILE.
Crea domande a scelta multipla semplici e dirette che testano concetti di base.
Le domande devono essere chiare con una risposta ovviamente corretta.
RISPONDI SEMPRE IN ITALIANO.`,
    medium: `Sei un insegnante specializzato nella creazione di quiz educativi di livello MEDIO.
Crea domande a scelta multipla che testano comprensione e applicazione di concetti.
Le opzioni sbagliate devono essere plausibili ma distinguibili da quella corretta.
RISPONDI SEMPRE IN ITALIANO.`,
    hard: `Sei un insegnante specializzato nella creazione di quiz educativi di livello DIFFICILE.
Crea domande a scelta multipla che testano analisi, sintesi e pensiero critico.
Le opzioni devono essere impegnative con distinzioni sottili tra le risposte.
RISPONDI SEMPRE IN ITALIANO.`,
  },
};

const quizUserPrompts: Record<string, string> = {
  pt: `Com base no seguinte conteúdo de estudo, cria perguntas de quiz de escolha múltipla.

Para cada pergunta:
- Escreve a pergunta de forma clara
- Fornece exatamente 4 opções (A, B, C, D)
- Indica qual é a opção correta
- Escreve uma explicação educativa que explique porque a resposta correta está certa e porque as outras estão erradas

Retorna a resposta APENAS como um array JSON válido no seguinte formato:
[
  {
    "questionText": "A pergunta aqui",
    "options": [
      {"id": "A", "text": "Opção A"},
      {"id": "B", "text": "Opção B"},
      {"id": "C", "text": "Opção C"},
      {"id": "D", "text": "Opção D"}
    ],
    "correctOptionId": "A",
    "explanation": "Explicação detalhada da resposta correta e porque as outras estão erradas"
  }
]

Conteúdo de estudo:`,
  en: `Based on the following study content, create multiple choice quiz questions.

For each question:
- Write the question clearly
- Provide exactly 4 options (A, B, C, D)
- Indicate which option is correct
- Write an educational explanation that explains why the correct answer is right and why the others are wrong

Return the response ONLY as a valid JSON array in the following format:
[
  {
    "questionText": "The question here",
    "options": [
      {"id": "A", "text": "Option A"},
      {"id": "B", "text": "Option B"},
      {"id": "C", "text": "Option C"},
      {"id": "D", "text": "Option D"}
    ],
    "correctOptionId": "A",
    "explanation": "Detailed explanation of the correct answer and why others are wrong"
  }
]

Study content:`,
  es: `Basándote en el siguiente contenido de estudio, crea preguntas de quiz de opción múltiple.

Para cada pregunta:
- Escribe la pregunta de forma clara
- Proporciona exactamente 4 opciones (A, B, C, D)
- Indica cuál es la opción correcta
- Escribe una explicación educativa que explique por qué la respuesta correcta es correcta y por qué las otras están mal

Devuelve la respuesta SOLO como un array JSON válido en el siguiente formato:
[
  {
    "questionText": "La pregunta aquí",
    "options": [
      {"id": "A", "text": "Opción A"},
      {"id": "B", "text": "Opción B"},
      {"id": "C", "text": "Opción C"},
      {"id": "D", "text": "Opción D"}
    ],
    "correctOptionId": "A",
    "explanation": "Explicación detallada de la respuesta correcta y por qué las otras están mal"
  }
]

Contenido de estudio:`,
  fr: `Sur la base du contenu d'étude suivant, crée des questions de quiz à choix multiples.

Pour chaque question:
- Écris la question clairement
- Fournis exactement 4 options (A, B, C, D)
- Indique quelle option est correcte
- Écris une explication éducative qui explique pourquoi la bonne réponse est correcte et pourquoi les autres sont fausses

Retourne la réponse UNIQUEMENT sous forme d'un tableau JSON valide au format suivant:
[
  {
    "questionText": "La question ici",
    "options": [
      {"id": "A", "text": "Option A"},
      {"id": "B", "text": "Option B"},
      {"id": "C", "text": "Option C"},
      {"id": "D", "text": "Option D"}
    ],
    "correctOptionId": "A",
    "explanation": "Explication détaillée de la bonne réponse et pourquoi les autres sont fausses"
  }
]

Contenu d'étude:`,
  de: `Erstelle basierend auf dem folgenden Studieninhalt Multiple-Choice-Quiz-Fragen.

Für jede Frage:
- Schreibe die Frage klar
- Gib genau 4 Optionen an (A, B, C, D)
- Gib an, welche Option richtig ist
- Schreibe eine lehrreiche Erklärung, die erklärt, warum die richtige Antwort richtig ist und warum die anderen falsch sind

Gib die Antwort NUR als gültiges JSON-Array im folgenden Format zurück:
[
  {
    "questionText": "Die Frage hier",
    "options": [
      {"id": "A", "text": "Option A"},
      {"id": "B", "text": "Option B"},
      {"id": "C", "text": "Option C"},
      {"id": "D", "text": "Option D"}
    ],
    "correctOptionId": "A",
    "explanation": "Detaillierte Erklärung der richtigen Antwort und warum andere falsch sind"
  }
]

Studieninhalt:`,
  it: `In base al seguente contenuto di studio, crea domande quiz a scelta multipla.

Per ogni domanda:
- Scrivi la domanda in modo chiaro
- Fornisci esattamente 4 opzioni (A, B, C, D)
- Indica quale opzione è corretta
- Scrivi una spiegazione educativa che spiega perché la risposta corretta è giusta e perché le altre sono sbagliate

Restituisci la risposta SOLO come un array JSON valido nel seguente formato:
[
  {
    "questionText": "La domanda qui",
    "options": [
      {"id": "A", "text": "Opzione A"},
      {"id": "B", "text": "Opzione B"},
      {"id": "C", "text": "Opzione C"},
      {"id": "D", "text": "Opzione D"}
    ],
    "correctOptionId": "A",
    "explanation": "Spiegazione dettagliata della risposta corretta e perché le altre sono sbagliate"
  }
]

Contenuto di studio:`,
};

const quizErrorMessages: Record<string, Record<string, string>> = {
  pt: {
    invalidFormat: "Formato de resposta inválido do AI",
    invalidArray: "A resposta não é um array válido",
    noValidQuestions: "Não foi possível gerar perguntas válidas",
    generalError: "Erro ao gerar quiz",
  },
  en: {
    invalidFormat: "Invalid AI response format",
    invalidArray: "Response is not a valid array",
    noValidQuestions: "Could not generate valid questions",
    generalError: "Error generating quiz",
  },
  es: {
    invalidFormat: "Formato de respuesta AI inválido",
    invalidArray: "La respuesta no es un array válido",
    noValidQuestions: "No se pudieron generar preguntas válidas",
    generalError: "Error al generar quiz",
  },
  fr: {
    invalidFormat: "Format de réponse AI invalide",
    invalidArray: "La réponse n'est pas un tableau valide",
    noValidQuestions: "Impossible de générer des questions valides",
    generalError: "Erreur lors de la génération du quiz",
  },
  de: {
    invalidFormat: "Ungültiges AI-Antwortformat",
    invalidArray: "Antwort ist kein gültiges Array",
    noValidQuestions: "Konnte keine gültigen Fragen generieren",
    generalError: "Fehler beim Generieren des Quiz",
  },
  it: {
    invalidFormat: "Formato risposta AI non valido",
    invalidArray: "La risposta non è un array valido",
    noValidQuestions: "Impossibile generare domande valide",
    generalError: "Errore nella generazione del quiz",
  },
};

export interface GenerateQuizParams {
  summaryText: string;
  language?: string;
  difficulty?: "easy" | "medium" | "hard";
  questionCount?: number;
  maxCompletionTokens?: number;
}

export async function generateQuiz({
  summaryText,
  language = "pt",
  difficulty = "medium",
  questionCount = 10,
  maxCompletionTokens = 4096,
}: GenerateQuizParams): Promise<QuizQuestionItem[]> {
  try {
    const lang = normalizeLanguage(language, "pt");
    const systemPrompt = quizSystemPrompts[lang]?.[difficulty] || quizSystemPrompts["pt"][difficulty];
    const userPrompt = quizUserPrompts[lang] || quizUserPrompts["pt"];
    const errors = quizErrorMessages[lang] || quizErrorMessages["pt"];

    const countInstructions: Record<string, string> = {
      pt: `\n\nCria exatamente ${questionCount} perguntas.`,
      en: `\n\nCreate exactly ${questionCount} questions.`,
      es: `\n\nCrea exactamente ${questionCount} preguntas.`,
      fr: `\n\nCrée exactement ${questionCount} questions.`,
      de: `\n\nErstelle genau ${questionCount} Fragen.`,
      it: `\n\nCrea esattamente ${questionCount} domande.`,
    };

    const fullUserPrompt = userPrompt + "\n\n" + summaryText + (countInstructions[lang] || countInstructions["pt"]);

    console.log("[generateQuiz] Starting quiz generation:", { language: lang, difficulty, questionCount });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullUserPrompt },
      ],
      max_completion_tokens: maxCompletionTokens,
    }, {
      timeout: 120000,
    });

    console.log("[generateQuiz] GPT response status:", response.choices[0].finish_reason);

    const content = response.choices[0].message.content || "[]";
    
    // Clean JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/```\n?/g, "");
    }

    // Parse JSON
    let questions;
    try {
      questions = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("[generateQuiz] Failed to parse JSON:", parseError);
      console.error("[generateQuiz] Content received:", content.substring(0, 500));
      throw new Error(errors.invalidFormat);
    }

    // Validate structure
    if (!Array.isArray(questions)) {
      console.error("[generateQuiz] Response is not an array:", questions);
      throw new Error(errors.invalidArray);
    }

    // Validate each question
    const validQuestions = questions.filter((q: any) => 
      q && 
      q.questionText && 
      typeof q.questionText === "string" &&
      Array.isArray(q.options) && 
      q.options.length === 4 &&
      q.correctOptionId &&
      q.explanation &&
      q.options.every((opt: any) => opt.id && opt.text)
    );

    console.log("[generateQuiz] Valid questions:", validQuestions.length, "out of", questions.length);

    if (validQuestions.length === 0) {
      console.error("[generateQuiz] No valid questions after filtering");
      throw new Error(errors.noValidQuestions);
    }

    return validQuestions as QuizQuestionItem[];
  } catch (error) {
    console.error("[generateQuiz] Error generating quiz:", error);
    const lang = language || "pt";
    const errors = quizErrorMessages[lang] || quizErrorMessages["pt"];
    
    if (error instanceof Error) {
      const localizedErrors = Object.values(errors);
      if (localizedErrors.some(msg => error.message.includes(msg))) {
        throw error;
      }
    }
    throw new Error(errors.generalError);
  }
}
