import { db } from "./db";
import { chatThreads, chatMessages, contentItems, topics, summaries, type ChatMode, chatModes } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STUDY_MODE_SYSTEM_PROMPT = `És um assistente de estudo inteligente e paciente. O teu objetivo é ajudar o utilizador a compreender melhor os seus materiais de estudo.

Quando responderes:
- Usa uma linguagem clara e acessível
- Explica conceitos de forma estruturada
- Dá exemplos práticos quando apropriado
- Faz perguntas para verificar a compreensão
- Sugere técnicas de estudo eficazes
- Mantém sempre um tom encorajador e positivo

Se tiveres acesso ao conteúdo do tópico, usa-o para dar respostas mais precisas e contextualizadas. Se não tiveres contexto suficiente, pede ao utilizador que partilhe mais informação ou faz perguntas para entender melhor a dúvida.`;

const EXISTENTIAL_MODE_SYSTEM_PROMPT = `És um mentor empático e sábio, focado no bem-estar emocional e desenvolvimento pessoal do utilizador.

O teu papel é:
- Ouvir com empatia e sem julgamento
- Ajudar com questões de motivação, foco, ansiedade e propósito
- Oferecer perspetivas construtivas e encorajadoras
- Sugerir técnicas de respiração, mindfulness ou gestão de stress quando apropriado
- Validar emoções e ajudar a encontrar equilíbrio
- Usar uma linguagem calorosa, autêntica e próxima

Lembra-te: o teu objetivo é ajudar a pessoa a encontrar o seu próprio caminho, não dar respostas prontas. Faz perguntas reflexivas quando apropriado.

Importante: Não és um terapeuta profissional. Se percebes sinais de problemas de saúde mental graves, sugere sempre procurar apoio profissional.`;

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

  const thread = await db
    .insert(chatThreads)
    .values({
      userId,
      mode: validatedMode,
      topicId: topicId || null,
      title: title || (validatedMode === "study" ? "Nova Conversa - Estudo" : "Nova Conversa - Reflexão"),
      isActive: true,
    })
    .returning();

  return thread[0];
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
  const { threadId, userId, userMessage } = options;

  const { thread, messages } = await getChatHistory(threadId, userId);

  if (!thread) {
    throw new Error("Thread não encontrado");
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

  let systemPrompt =
    thread.mode === "study" ? STUDY_MODE_SYSTEM_PROMPT : EXISTENTIAL_MODE_SYSTEM_PROMPT;

  let contextAddition = "";
  if (thread.mode === "study" && thread.topicId) {
    const topicContext = await getTopicContext(thread.topicId, userId);
    if (topicContext) {
      contextAddition = `\n\nCONTEXTO DO TÓPICO:\n${topicContext}`;
    }
  }

  const conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt + contextAddition },
  ];

  for (const msg of messages) {
    conversationHistory.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: conversationHistory,
    temperature: 0.7,
    max_tokens: 1000,
  });

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
