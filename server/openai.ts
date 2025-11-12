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

const learningStylePrompts = {
  visual: `Você é um tutor educacional especializado em aprendizagem visual. Crie um resumo que:
- Use metáforas visuais e descrições espaciais
- Organize a informação em estruturas claras (como blocos, camadas, fluxos)
- Sugira diagramas ou mapas mentais quando apropriado
- Use linguagem que evoca imagens mentais fortes`,

  auditivo: `Você é um tutor educacional especializado em aprendizagem auditiva. Crie um resumo que:
- Use um tom narrativo e conversacional
- Explique conceitos como se estivesse contando uma história
- Use ritmo e repetição para reforçar pontos-chave
- Inclua analogias e exemplos do dia-a-dia`,

  logico: `Você é um tutor educacional especializado em aprendizagem lógica. Crie um resumo que:
- Organize a informação em passos sequenciais claros
- Use estruturas numeradas e hierárquicas
- Destaque relações de causa e efeito
- Apresente raciocínio analítico e padrões`,

  conciso: `Você é um tutor educacional especializado em síntese objetiva. Crie um resumo que:
- Vá direto aos pontos-chave essenciais
- Use frases curtas e diretas
- Elimine informação redundante
- Apresente apenas o mais importante de forma clara`,
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
      max_completion_tokens: 2048,
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
