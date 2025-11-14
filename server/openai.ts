import OpenAI from "openai";

// This is using OpenAI's API, which points to OpenAI's API servers and requires your own API key.
// The newest OpenAI model is "gpt-5" which was released August 7, 2025. Do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface GenerateSummaryParams {
  text: string;
  learningStyle: "visual" | "auditivo" | "logico" | "conciso";
}

export interface SummaryResult {
  summary: string;
  motivationalMessage: string;
}

export interface FlashcardItem {
  question: string;
  answer: string;
}

const learningStylePrompts = {
  visual: `Tutor visual: crie resumo com metáforas visuais, organize em estruturas claras (blocos, fluxos), sugira diagramas quando útil. Use linguagem que evoca imagens mentais.`,

  auditivo: `Tutor auditivo: crie resumo narrativo e conversacional, explique como história, use ritmo e repetição, inclua analogias do dia-a-dia.`,

  logico: `Tutor lógico: organize em passos sequenciais numerados, destaque causa e efeito, apresente raciocínio analítico e padrões.`,

  conciso: `Tutor objetivo: resumo direto aos pontos-chave, frases curtas, elimine redundância, apresente apenas o essencial.`,
};

const motivationalPrompts = {
  visual: "Crie uma mensagem motivacional curta (1-2 frases) que use linguagem visual e inspire o estudante a imaginar o seu sucesso.",
  auditivo: "Crie uma mensagem motivacional curta (1-2 frases) em tom encorajador e conversacional que ressoe emocionalmente.",
  logico: "Crie uma mensagem motivacional curta (1-2 frases) que apresente uma lógica inspiradora sobre o progresso do estudante.",
  conciso: "Crie uma mensagem motivacional curta (1 frase) poderosa e direta que motive ação imediata.",
};

export async function generateSummary({
  text,
  learningStyle,
}: GenerateSummaryParams): Promise<SummaryResult> {
  try {
    const systemPrompt = learningStylePrompts[learningStyle];
    const motivationalPrompt = motivationalPrompts[learningStyle];

    // Generate the summary
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Por favor, crie um resumo do seguinte texto adaptado ao estilo de aprendizagem especificado:\n\n${text}`,
        },
      ],
      max_completion_tokens: 8192, // Increased to allow for reasoning tokens + actual response
    });

    console.log(`[OpenAI] Summary generation for ${learningStyle} style:`, {
      hasContent: !!summaryResponse.choices[0]?.message?.content,
      contentLength: summaryResponse.choices[0]?.message?.content?.length || 0,
      finishReason: summaryResponse.choices[0]?.finish_reason,
      usage: summaryResponse.usage,
      inputTextLength: text.length,
      promptLength: systemPrompt.length,
    });

    const summary = summaryResponse.choices[0].message.content || "Não foi possível gerar o resumo.";

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
          content: "Gere uma mensagem motivacional para um estudante que acabou de receber este resumo.",
        },
      ],
      max_completion_tokens: 150,
    });

    const motivationalMessage = motivationalResponse.choices[0].message.content || "Continue estudando e alcançará seus objetivos!";

    return {
      summary,
      motivationalMessage,
    };
  } catch (error) {
    console.error("Error generating summary with GPT-5:", error);
    throw new Error("Falha ao gerar resumo. Por favor, tente novamente.");
  }
}

export async function generateFlashcards(summaryText: string): Promise<FlashcardItem[]> {
  try {
    const systemPrompt = `Você é um especialista em educação que cria flashcards eficazes para estudo.
Crie flashcards com perguntas claras e respostas concisas baseadas no texto fornecido.
Cada flashcard deve testar um conceito-chave ou fato importante.
Gere entre 5 e 10 flashcards.

Retorne a resposta APENAS como um array JSON válido no seguinte formato:
[
  {"question": "Pergunta aqui?", "answer": "Resposta concisa aqui"},
  {"question": "Outra pergunta?", "answer": "Outra resposta"}
]

NÃO inclua nenhum texto adicional, markdown, ou explicações. APENAS o array JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Crie flashcards baseados neste resumo:\n\n${summaryText}`,
        },
      ],
      max_completion_tokens: 2048,
    });

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
      throw new Error("Formato de resposta inválido da IA");
    }
    
    console.log("[generateFlashcards] Parsed flashcards count:", Array.isArray(flashcards) ? flashcards.length : "not an array");
    if (Array.isArray(flashcards) && flashcards.length > 0) {
      console.log("[generateFlashcards] First flashcard:", JSON.stringify(flashcards[0]));
    }
    
    // Validate the structure
    if (!Array.isArray(flashcards)) {
      console.error("Response is not an array:", flashcards);
      throw new Error("A resposta da IA não é um array de flashcards");
    }
    
    // Ensure each flashcard has question and answer
    const validFlashcards = flashcards.filter(
      (fc) => fc && fc.question && fc.answer && typeof fc.question === "string" && typeof fc.answer === "string"
    );
    
    console.log("[generateFlashcards] Valid flashcards:", validFlashcards.length, "out of", flashcards.length);
    
    if (validFlashcards.length === 0) {
      console.error("No valid flashcards after filtering. Total received:", flashcards.length);
      if (flashcards.length > 0) {
        console.error("Sample invalid flashcard:", JSON.stringify(flashcards[0]));
      }
      throw new Error("Nenhum flashcard válido foi gerado. Por favor, tente novamente.");
    }
    
    return validFlashcards;
  } catch (error) {
    console.error("Error generating flashcards with GPT-5:", error);
    if (error instanceof Error && error.message.includes("IA")) {
      throw error;
    }
    throw new Error("Falha ao gerar flashcards. Por favor, tente novamente.");
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
