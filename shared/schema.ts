import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { desc } from "drizzle-orm";

// Learning style enum
export const learningStyles = ["visual", "auditivo", "logico", "conciso"] as const;
export type LearningStyle = typeof learningStyles[number];

// XP Actions enum
export const xpActions = [
  "upload_pdf",
  "generate_summary",
  "create_flashcards",
  "complete_study_session",
  "daily_streak_bonus",
  "daily_chat_interaction",
  "level_up_bonus",
] as const;
export type XpAction = typeof xpActions[number];

// User Levels enum
export const userLevels = ["iniciante", "explorador", "mentor", "mestre"] as const;
export type UserLevel = typeof userLevels[number];

// Level configuration (icons will be rendered using lucide-react in UI)
export const levelConfig = {
  iniciante: { minXp: 0, maxXp: 299, icon: "feather", name: "Iniciante" },
  explorador: { minXp: 300, maxXp: 899, icon: "book-open", name: "Explorador" },
  mentor: { minXp: 900, maxXp: 1999, icon: "brain", name: "Mentor" },
  mestre: { minXp: 2000, maxXp: Infinity, icon: "rocket", name: "Mestre do Foco" },
};

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Gamification fields (displayName nullable until user sets it)
  displayName: varchar("display_name"),
  totalXp: integer("total_xp").default(0).notNull(),
  currentLevel: varchar("current_level", { length: 20 }).default("iniciante").notNull(),
  // Premium fields
  premiumActive: boolean("premium_active").default(false).notNull(),
  premiumSince: timestamp("premium_since"),
  // Daily interaction tracking
  lastDailyChatXp: timestamp("last_daily_chat_xp"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Summaries table
export const summaries = pgTable(
  "summaries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    learningStyle: varchar("learning_style", { length: 20 }).notNull(),
    summary: text("summary").notNull(),
    motivationalMessage: text("motivational_message").notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_summaries_user_id").on(table.userId),
    index("idx_summaries_created_at").on(table.createdAt),
  ],
);

export const insertSummarySchema = createInsertSchema(summaries).omit({
  id: true,
  createdAt: true,
});

export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Summary = typeof summaries.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  summaries: many(summaries),
  studySessions: many(studySessions),
  flashcardAttempts: many(flashcardAttempts),
  xpEvents: many(xpEvents),
  chatThreads: many(chatThreads),
}));

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  user: one(users, {
    fields: [summaries.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
  studySessions: many(studySessions),
}));

// Flashcards table
export const flashcards = pgTable(
  "flashcards",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    summaryId: varchar("summary_id").notNull().references(() => summaries.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_flashcards_summary_id").on(table.summaryId),
  ],
);

export const insertFlashcardSchema = createInsertSchema(flashcards).omit({
  id: true,
  createdAt: true,
});

export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Flashcard = typeof flashcards.$inferSelect;

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  summary: one(summaries, {
    fields: [flashcards.summaryId],
    references: [summaries.id],
  }),
  attempts: many(flashcardAttempts),
}));

// Study Sessions table (for progress tracking)
export const studySessions = pgTable(
  "study_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    summaryId: varchar("summary_id").notNull().references(() => summaries.id, { onDelete: "cascade" }),
    totalFlashcards: integer("total_flashcards").notNull(),
    correctFlashcards: integer("correct_flashcards").notNull().default(0),
    incorrectFlashcards: integer("incorrect_flashcards").notNull().default(0),
    studyDate: timestamp("study_date").notNull(),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: index("idx_study_sessions_user_date").on(table.userId, desc(table.studyDate)),
    userSummaryIdx: index("idx_study_sessions_user_summary").on(table.userId, table.summaryId),
  }),
);

export const insertStudySessionSchema = createInsertSchema(studySessions).omit({
  id: true,
  createdAt: true,
});

export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessions.$inferSelect;

// Flashcard Attempts table (for spaced repetition tracking)
export const flashcardAttempts = pgTable(
  "flashcard_attempts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    flashcardId: varchar("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
    isCorrect: boolean("is_correct").notNull(),
    attemptDate: timestamp("attempt_date").defaultNow().notNull(),
    nextReviewDate: timestamp("next_review_date"),
    easeFactor: integer("ease_factor").default(250).notNull(),
    intervalDays: integer("interval_days").default(0).notNull(),
    repetitions: integer("repetitions").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userFlashcardIdx: index("idx_flashcard_attempts_user_flashcard").on(table.userId, table.flashcardId),
    nextReviewIdx: index("idx_flashcard_attempts_next_review").on(table.userId, table.nextReviewDate),
  }),
);

export const insertFlashcardAttemptSchema = createInsertSchema(flashcardAttempts).omit({
  id: true,
  createdAt: true,
});

export type InsertFlashcardAttempt = z.infer<typeof insertFlashcardAttemptSchema>;
export type FlashcardAttempt = typeof flashcardAttempts.$inferSelect;

export const studySessionsRelations = relations(studySessions, ({ one }) => ({
  user: one(users, {
    fields: [studySessions.userId],
    references: [users.id],
  }),
  summary: one(summaries, {
    fields: [studySessions.summaryId],
    references: [summaries.id],
  }),
}));

export const flashcardAttemptsRelations = relations(flashcardAttempts, ({ one }) => ({
  user: one(users, {
    fields: [flashcardAttempts.userId],
    references: [users.id],
  }),
  flashcard: one(flashcards, {
    fields: [flashcardAttempts.flashcardId],
    references: [flashcards.id],
  }),
}));

// XP Events table (for gamification tracking)
export const xpEvents = pgTable(
  "xp_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull(),
    xpAwarded: integer("xp_awarded").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_xp_events_user_id").on(table.userId),
    index("idx_xp_events_created_at").on(desc(table.createdAt)),
  ],
);

export const insertXpEventSchema = createInsertSchema(xpEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertXpEvent = z.infer<typeof insertXpEventSchema>;
export type XpEvent = typeof xpEvents.$inferSelect;

export const xpEventsRelations = relations(xpEvents, ({ one }) => ({
  user: one(users, {
    fields: [xpEvents.userId],
    references: [users.id],
  }),
}));

// Chat Threads table (for mentor chat conversations)
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").default("Nova Conversa").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_chat_threads_user_id").on(table.userId),
    index("idx_chat_threads_last_activity").on(desc(table.lastActivityAt)),
  ],
);

export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({
  id: true,
  createdAt: true,
  lastActivityAt: true,
});

export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type ChatThread = typeof chatThreads.$inferSelect;

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  user: one(users, {
    fields: [chatThreads.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

// Chat Messages table
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: varchar("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
    content: text("content").notNull(),
    xpAwarded: integer("xp_awarded").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_chat_messages_thread_id").on(table.threadId),
    index("idx_chat_messages_created_at").on(desc(table.createdAt)),
  ],
);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [chatMessages.threadId],
    references: [chatThreads.id],
  }),
}));

// API request/response types
export const generateSummaryRequestSchema = z.object({
  learningStyle: z.enum(learningStyles),
});

export type GenerateSummaryRequest = z.infer<typeof generateSummaryRequestSchema>;

// API Summary type (with createdAt as string for JSON serialization)
export const apiSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  fileName: z.string(),
  learningStyle: z.enum(learningStyles),
  summary: z.string(),
  motivationalMessage: z.string(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
});

export type ApiSummary = z.infer<typeof apiSummarySchema>;

export const generateSummaryResponseSchema = z.object({
  success: z.boolean(),
  summary: apiSummarySchema.optional(),
  error: z.string().optional(),
});

export type GenerateSummaryResponse = z.infer<typeof generateSummaryResponseSchema>;

// Flashcard API types
export const apiFlashcardSchema = z.object({
  id: z.string(),
  summaryId: z.string(),
  question: z.string(),
  answer: z.string(),
  createdAt: z.string(),
});

export type ApiFlashcard = z.infer<typeof apiFlashcardSchema>;

export const generateFlashcardsRequestSchema = z.object({
  summaryId: z.string(),
});

export type GenerateFlashcardsRequest = z.infer<typeof generateFlashcardsRequestSchema>;

export const generateFlashcardsResponseSchema = z.object({
  success: z.boolean(),
  flashcards: z.array(apiFlashcardSchema).optional(),
  error: z.string().optional(),
});

export type GenerateFlashcardsResponse = z.infer<typeof generateFlashcardsResponseSchema>;

// Study Progress API types
export const recordStudySessionRequestSchema = z.object({
  summaryId: z.string(),
  totalFlashcards: z.number().int().positive(),
  correctFlashcards: z.number().int().min(0),
  incorrectFlashcards: z.number().int().min(0),
  studyDate: z.string(),
  durationSeconds: z.number().int().positive().optional(),
});

export type RecordStudySessionRequest = z.infer<typeof recordStudySessionRequestSchema>;

export const recordStudySessionResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type RecordStudySessionResponse = z.infer<typeof recordStudySessionResponseSchema>;

// Dashboard Stats API types
export const dashboardStatsSchema = z.object({
  totalPDFsStudied: z.number().int(),
  totalFlashcardsCompleted: z.number().int(),
  studyStreak: z.number().int(),
  averageAccuracy: z.number(),
  totalStudySessions: z.number().int(),
  recentSessions: z.array(z.object({
    date: z.string(),
    flashcardsCompleted: z.number().int(),
    accuracy: z.number(),
  })),
  studiedPDFs: z.array(z.object({
    id: z.string(),
    fileName: z.string(),
    learningStyle: z.string(),
    lastStudied: z.string(),
    totalSessions: z.number().int(),
    averageAccuracy: z.number(),
    createdAt: z.string(),
  })),
  recentStudySessions: z.array(z.object({
    id: z.string(),
    fileName: z.string(),
    studyDate: z.string(),
    totalFlashcards: z.number().int(),
    correctFlashcards: z.number().int(),
    incorrectFlashcards: z.number().int(),
    accuracy: z.number(),
  })),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const getDashboardStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: dashboardStatsSchema.optional(),
  error: z.string().optional(),
});

export type GetDashboardStatsResponse = z.infer<typeof getDashboardStatsResponseSchema>;

// Review Plan API types
export const getReviewPlanRequestSchema = z.object({
  limit: z.number().int().positive().optional().default(5),
});

export type GetReviewPlanRequest = z.infer<typeof getReviewPlanRequestSchema>;

export const reviewPlanItemSchema = z.object({
  summaryId: z.string(),
  fileName: z.string(),
  lastStudied: z.string(),
  accuracy: z.number(),
  priority: z.string(),
  recommendation: z.string(),
});

export type ReviewPlanItem = z.infer<typeof reviewPlanItemSchema>;

export const getReviewPlanResponseSchema = z.object({
  success: z.boolean(),
  reviewPlan: z.array(reviewPlanItemSchema).optional(),
  aiRecommendation: z.string().optional(),
  error: z.string().optional(),
});

export type GetReviewPlanResponse = z.infer<typeof getReviewPlanResponseSchema>;
