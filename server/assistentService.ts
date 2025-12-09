import { db } from "./db";
import { chatThreads, chatMessages, contentItems, topics, summaries, type ChatMode, chatModes } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { normalizeLanguage } from "./languageHelper";
import { costControlService } from "./costControlService";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout
  maxRetries: 2, // Retry twice on temporary failures
});

const STUDY_MODE_PROMPTS: Record<string, string> = {
  pt: `És um assistente de estudo inteligente e paciente. O teu objetivo é ajudar o utilizador a compreender melhor os seus materiais de estudo.

Quando responderes:
- Usa uma linguagem clara e acessível
- Explica conceitos de forma estruturada
- Dá exemplos práticos quando apropriado
- Faz perguntas para verificar a compreensão
- Sugere técnicas de estudo eficazes
- Mantém sempre um tom encorajador e positivo

Se tiveres acesso ao conteúdo do tópico, usa-o para dar respostas mais precisas e contextualizadas. Se não tiveres contexto suficiente, pede ao utilizador que partilhe mais informação ou faz perguntas para entender melhor a dúvida.
RESPONDE SEMPRE EM PORTUGUÊS.`,
  en: `You are an intelligent and patient study assistant. Your goal is to help the user better understand their study materials.

When responding:
- Use clear and accessible language
- Explain concepts in a structured way
- Give practical examples when appropriate
- Ask questions to verify understanding
- Suggest effective study techniques
- Always maintain an encouraging and positive tone

If you have access to the topic content, use it to provide more precise and contextualized answers. If you don't have enough context, ask the user to share more information or ask questions to better understand the doubt.
ALWAYS RESPOND IN ENGLISH.`,
  es: `Eres un asistente de estudio inteligente y paciente. Tu objetivo es ayudar al usuario a comprender mejor sus materiales de estudio.

Cuando respondas:
- Usa un lenguaje claro y accesible
- Explica conceptos de forma estructurada
- Da ejemplos prácticos cuando sea apropiado
- Haz preguntas para verificar la comprensión
- Sugiere técnicas de estudio eficaces
- Mantén siempre un tono alentador y positivo

Si tienes acceso al contenido del tema, úsalo para dar respuestas más precisas y contextualizadas. Si no tienes suficiente contexto, pide al usuario que comparta más información o haz preguntas para entender mejor la duda.
RESPONDE SIEMPRE EN ESPAÑOL.`,
  fr: `Vous êtes un assistant d'étude intelligent et patient. Votre objectif est d'aider l'utilisateur à mieux comprendre ses matériaux d'étude.

Lorsque vous répondez :
- Utilisez un langage clair et accessible
- Expliquez les concepts de manière structurée
- Donnez des exemples pratiques lorsque approprié
- Posez des questions pour vérifier la compréhension
- Suggérez des techniques d'étude efficaces
- Maintenez toujours un ton encourageant et positif

Si vous avez accès au contenu du sujet, utilisez-le pour fournir des réponses plus précises et contextualisées. Si vous n'avez pas assez de contexte, demandez à l'utilisateur de partager plus d'informations ou posez des questions pour mieux comprendre le doute.
RÉPONDEZ TOUJOURS EN FRANÇAIS.`,
  de: `Sie sind ein intelligenter und geduldiger Studienassistent. Ihr Ziel ist es, dem Benutzer zu helfen, seine Studienmaterialien besser zu verstehen.

Beim Antworten:
- Verwenden Sie klare und zugängliche Sprache
- Erklären Sie Konzepte strukturiert
- Geben Sie praktische Beispiele, wenn angemessen
- Stellen Sie Fragen zur Überprüfung des Verständnisses
- Schlagen Sie effektive Lerntechniken vor
- Behalten Sie immer einen ermutigenden und positiven Ton bei

Wenn Sie Zugriff auf den Themeninhalt haben, nutzen Sie ihn, um präzisere und kontextbezogene Antworten zu geben. Wenn Sie nicht genug Kontext haben, bitten Sie den Benutzer, mehr Informationen zu teilen, oder stellen Sie Fragen, um den Zweifel besser zu verstehen.
ANTWORTEN SIE IMMER AUF DEUTSCH.`,
  it: `Sei un assistente di studio intelligente e paziente. Il tuo obiettivo è aiutare l'utente a comprendere meglio i suoi materiali di studio.

Quando rispondi:
- Usa un linguaggio chiaro e accessibile
- Spiega concetti in modo strutturato
- Fornisci esempi pratici quando appropriato
- Fai domande per verificare la comprensione
- Suggerisci tecniche di studio efficaci
- Mantieni sempre un tono incoraggiante e positivo

Se hai accesso al contenuto dell'argomento, usalo per fornire risposte più precise e contestualizzate. Se non hai abbastanza contesto, chiedi all'utente di condividere più informazioni o fai domande per capire meglio il dubbio.
RISPONDI SEMPRE IN ITALIANO.`,
};

const EXISTENTIAL_MODE_PROMPTS: Record<string, string> = {
  pt: `És um mentor empático e sábio, focado no bem-estar emocional e desenvolvimento pessoal do utilizador.

O teu papel é:
- Ouvir com empatia e sem julgamento
- Ajudar com questões de motivação, foco, ansiedade e propósito
- Oferecer perspetivas construtivas e encorajadoras
- Sugerir técnicas de respiração, mindfulness ou gestão de stress quando apropriado
- Validar emoções e ajudar a encontrar equilíbrio
- Usar uma linguagem calorosa, autêntica e próxima

Lembra-te: o teu objetivo é ajudar a pessoa a encontrar o seu próprio caminho, não dar respostas prontas. Faz perguntas reflexivas quando apropriado.

Importante: Não és um terapeuta profissional. Se percebes sinais de problemas de saúde mental graves, sugere sempre procurar apoio profissional.
RESPONDE SEMPRE EM PORTUGUÊS.`,
  en: `You are an empathetic and wise mentor, focused on the user's emotional well-being and personal development.

Your role is to:
- Listen with empathy and without judgment
- Help with questions of motivation, focus, anxiety, and purpose
- Offer constructive and encouraging perspectives
- Suggest breathing techniques, mindfulness, or stress management when appropriate
- Validate emotions and help find balance
- Use warm, authentic, and close language

Remember: your goal is to help the person find their own path, not give ready-made answers. Ask reflective questions when appropriate.

Important: You are not a professional therapist. If you perceive signs of serious mental health problems, always suggest seeking professional support.
ALWAYS RESPOND IN ENGLISH.`,
  es: `Eres un mentor empático y sabio, enfocado en el bienestar emocional y desarrollo personal del usuario.

Tu papel es:
- Escuchar con empatía y sin juicio
- Ayudar con cuestiones de motivación, enfoque, ansiedad y propósito
- Ofrecer perspectivas constructivas y alentadoras
- Sugerir técnicas de respiración, mindfulness o gestión del estrés cuando sea apropiado
- Validar emociones y ayudar a encontrar equilibrio
- Usar un lenguaje cálido, auténtico y cercano

Recuerda: tu objetivo es ayudar a la persona a encontrar su propio camino, no dar respuestas preparadas. Haz preguntas reflexivas cuando sea apropiado.

Importante: No eres un terapeuta profesional. Si percibes señales de problemas graves de salud mental, sugiere siempre buscar apoyo profesional.
RESPONDE SIEMPRE EN ESPAÑOL.`,
  fr: `Vous êtes un mentor empathique et sage, axé sur le bien-être émotionnel et le développement personnel de l'utilisateur.

Votre rôle est de :
- Écouter avec empathie et sans jugement
- Aider avec des questions de motivation, de concentration, d'anxiété et de but
- Offrir des perspectives constructives et encourageantes
- Suggérer des techniques de respiration, de pleine conscience ou de gestion du stress lorsque approprié
- Valider les émotions et aider à trouver l'équilibre
- Utiliser un langage chaleureux, authentique et proche

Rappelez-vous : votre objectif est d'aider la personne à trouver son propre chemin, pas de donner des réponses toutes faites. Posez des questions réflexives lorsque approprié.

Important : Vous n'êtes pas un thérapeute professionnel. Si vous percevez des signes de problèmes de santé mentale graves, suggérez toujours de chercher un soutien professionnel.
RÉPONDEZ TOUJOURS EN FRANÇAIS.`,
  de: `Sie sind ein einfühlsamer und weiser Mentor, der sich auf das emotionale Wohlbefinden und die persönliche Entwicklung des Benutzers konzentriert.

Ihre Rolle ist es:
- Mit Empathie und ohne Urteil zuzuhören
- Bei Fragen zu Motivation, Fokus, Angst und Zweck zu helfen
- Konstruktive und ermutigende Perspektiven anzubieten
- Atemtechniken, Achtsamkeit oder Stressmanagement vorzuschlagen, wenn angemessen
- Emotionen zu validieren und beim Finden des Gleichgewichts zu helfen
- Eine warme, authentische und nahe Sprache zu verwenden

Denken Sie daran: Ihr Ziel ist es, der Person zu helfen, ihren eigenen Weg zu finden, nicht fertige Antworten zu geben. Stellen Sie reflektive Fragen, wenn angemessen.

Wichtig: Sie sind kein professioneller Therapeut. Wenn Sie Anzeichen ernsthafter psychischer Probleme wahrnehmen, schlagen Sie immer vor, professionelle Unterstützung zu suchen.
ANTWORTEN SIE IMMER AUF DEUTSCH.`,
  it: `Sei un mentore empatico e saggio, focalizzato sul benessere emotivo e sviluppo personale dell'utente.

Il tuo ruolo è:
- Ascoltare con empatia e senza giudizio
- Aiutare con questioni di motivazione, focus, ansia e scopo
- Offrire prospettive costruttive e incoraggianti
- Suggerire tecniche di respirazione, mindfulness o gestione dello stress quando appropriato
- Validare emozioni e aiutare a trovare equilibrio
- Usare un linguaggio caloroso, autentico e vicino

Ricorda: il tuo obiettivo è aiutare la persona a trovare il proprio percorso, non dare risposte pronte. Fai domande riflessive quando appropriato.

Importante: Non sei un terapeuta professionista. Se percepisci segnali di gravi problemi di salute mentale, suggerisci sempre di cercare supporto professionale.
RISPONDI SEMPRE IN ITALIANO.`,
};

export interface CreateThreadOptions {
  userId: string;
  mode: ChatMode;
  topicId?: string;
  title?: string;
}

export interface SendMessageOptions {
  threadId: string;
  userId: string;
  userMessage: string;
  language?: string;
}

export interface ChatResponse {
  threadId: string;
  userMessage: {
    id: string;
    content: string;
    role: "user";
    createdAt: Date;
  };
  assistantMessage: {
    id: string;
    content: string;
    role: "assistant";
    createdAt: Date;
  };
  xpAwarded: number;
}

export async function createChatThread(options: CreateThreadOptions) {
  const { userId, mode, topicId, title } = options;

  // Validate mode is one of the allowed values
  const modeSchema = z.enum(chatModes);
  const validatedMode = modeSchema.parse(mode);

  let threadTitle = title;
  
  if (!threadTitle && topicId && validatedMode === "study") {
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
    });
    
    if (topic) {
      threadTitle = topic.name;
    }
  }
  
  if (!threadTitle) {
    threadTitle = validatedMode === "study" ? "Nova Conversa - Estudo" : "Nova Conversa - Reflexão";
  }

  const thread = await db
    .insert(chatThreads)
    .values({
      userId,
      mode: validatedMode,
      topicId: topicId || null,
      title: threadTitle,
      isActive: true,
    })
    .returning();

  return thread[0];
}

export async function updateChatThreadTitle(threadId: string, userId: string, newTitle: string) {
  const thread = await db.query.chatThreads.findFirst({
    where: and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)),
  });

  if (!thread) {
    throw new Error("Thread não encontrado");
  }

  const updated = await db
    .update(chatThreads)
    .set({ title: newTitle })
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
    .returning();

  return updated[0];
}

export async function getChatHistory(threadId: string, userId: string) {
  const thread = await db.query.chatThreads.findFirst({
    where: and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)),
    with: {
      messages: {
        orderBy: [desc(chatMessages.createdAt)],
        limit: 50,
      },
      topic: true,
    },
  });

  if (!thread) {
    throw new Error("Thread não encontrado");
  }

  return {
    thread,
    messages: thread.messages.reverse(),
  };
}

async function getTopicContext(topicId: string, userId: string): Promise<string> {
  const topic = await db.query.topics.findFirst({
    where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
    with: {
      contentItems: {
        with: {
          summary: true,
        },
        limit: 10,
      },
    },
  });

  if (!topic || !topic.contentItems || topic.contentItems.length === 0) {
    return "";
  }

  let context = `Tópico: ${topic.name}\n`;
  if (topic.description) {
    context += `Descrição: ${topic.description}\n\n`;
  }

  context += "Materiais disponíveis:\n";
  for (const item of topic.contentItems) {
    context += `\n- ${item.title} (${item.contentType})\n`;
    
    if (item.extractedText) {
      const excerpt = item.extractedText.slice(0, 1500);
      context += `Conteúdo: ${excerpt}${item.extractedText.length > 1500 ? "..." : ""}\n`;
    }
    
    if (item.summary) {
      context += `Resumo: ${item.summary.summary.slice(0, 800)}${item.summary.summary.length > 800 ? "..." : ""}\n`;
    }
  }

  return context.slice(0, 8000);
}

export async function sendMessage(options: SendMessageOptions): Promise<ChatResponse> {
  const { threadId, userId, userMessage, language = "pt" } = options;

  const { thread, messages } = await getChatHistory(threadId, userId);

  if (!thread) {
    throw new Error("Thread não encontrado");
  }

  // INVISIBLE COST CONTROL: Get plan tier for controlling chat costs
  const planTier = await costControlService.getUserPlanTier(userId);
  
  // Check and apply soft daily limits (delays, never blocks)
  const usageCheck = await costControlService.checkDailyUsage(userId, "chat", planTier);
  if (usageCheck.shouldDelay) {
    await costControlService.applyDelayIfNeeded(usageCheck.delayMs);
  }

  const userMsg = await db
    .insert(chatMessages)
    .values({
      threadId,
      role: "user",
      content: userMessage,
      xpAwarded: 0,
    })
    .returning();

  const lang = normalizeLanguage(language, "pt");
  const studyPrompt = STUDY_MODE_PROMPTS[lang] || STUDY_MODE_PROMPTS["pt"];
  const existentialPrompt = EXISTENTIAL_MODE_PROMPTS[lang] || EXISTENTIAL_MODE_PROMPTS["pt"];
  
  // INVISIBLE COST CONTROL: Append plan-based depth modifier to system prompt
  const depthModifier = costControlService.getChatDepthModifier(planTier, lang);
  let systemPrompt =
    (thread.mode === "study" ? studyPrompt : existentialPrompt) + depthModifier;

  let contextAddition = "";
  if (thread.mode === "study" && thread.topicId) {
    let topicContext = await getTopicContext(thread.topicId, userId);
    // INVISIBLE COST CONTROL: Limit topic context based on plan
    if (topicContext) {
      topicContext = costControlService.limitTopicContext(topicContext, planTier);
      contextAddition = `\n\nCONTEXTO DO TÓPICO:\n${topicContext}`;
    }
  }

  // INVISIBLE COST CONTROL: Limit conversation history based on plan
  const limitedMessages = costControlService.limitChatContext(messages, planTier);
  
  const conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt + contextAddition },
  ];

  for (const msg of limitedMessages) {
    conversationHistory.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  // INVISIBLE COST CONTROL: Use plan-based max tokens
  const maxTokens = costControlService.getMaxCompletionTokens(planTier, "chat");
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: conversationHistory,
    temperature: 0.7,
    max_tokens: maxTokens,
  });
  
  // Increment daily usage counter
  costControlService.incrementDailyUsage(userId, "chat");

  const assistantResponse = completion.choices[0].message.content || "Desculpa, não consegui gerar uma resposta.";

  const xpAwarded = 0;

  const assistantMsg = await db
    .insert(chatMessages)
    .values({
      threadId,
      role: "assistant",
      content: assistantResponse,
      xpAwarded,
    })
    .returning();

  await db
    .update(chatThreads)
    .set({ lastActivityAt: new Date() })
    .where(eq(chatThreads.id, threadId));

  return {
    threadId,
    userMessage: {
      id: userMsg[0].id,
      content: userMsg[0].content,
      role: "user",
      createdAt: userMsg[0].createdAt,
    },
    assistantMessage: {
      id: assistantMsg[0].id,
      content: assistantMsg[0].content,
      role: "assistant",
      createdAt: assistantMsg[0].createdAt,
    },
    xpAwarded,
  };
}

export async function getUserThreads(userId: string, mode?: ChatMode) {
  const conditions = mode
    ? and(eq(chatThreads.userId, userId), eq(chatThreads.mode, mode), eq(chatThreads.isActive, true))
    : and(eq(chatThreads.userId, userId), eq(chatThreads.isActive, true));

  const threads = await db.query.chatThreads.findMany({
    where: conditions,
    orderBy: [desc(chatThreads.lastActivityAt)],
    limit: 20,
    with: {
      topic: true,
      messages: {
        orderBy: [desc(chatMessages.createdAt)],
        limit: 1,
      },
    },
  });

  return threads;
}

export async function deleteThread(threadId: string, userId: string) {
  const thread = await db.query.chatThreads.findFirst({
    where: and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)),
  });

  if (!thread) {
    throw new Error("Thread não encontrado");
  }

  await db
    .update(chatThreads)
    .set({ 
      isActive: false,
      lastActivityAt: new Date(),
    })
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));

  return true;
}
