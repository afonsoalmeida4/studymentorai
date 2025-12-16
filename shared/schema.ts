import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, uniqueIndex, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { desc } from "drizzle-orm";

// Learning style enum
export const learningStyles = ["visual", "logico", "conciso"] as const;
export type LearningStyle = typeof learningStyles[number];

// XP Actions enum
export const xpActions = [
  "upload_pdf",
  "generate_summary",
  "create_flashcards",
  "answer_flashcard",
  "complete_study_session",
  "daily_streak_bonus",
  "daily_chat_interaction",
  "level_up_bonus",
] as const;
export type XpAction = typeof xpActions[number];

// User Levels enum
export const userLevels = ["iniciante", "explorador", "mentor", "mestre"] as const;
export type UserLevel = typeof userLevels[number];

// User Roles enum (simplified - all users are students)
export const userRoles = ["student"] as const;
export type UserRole = typeof userRoles[number];

// Supported Languages enum
export const supportedLanguages = ["pt", "en", "es", "fr", "de", "it"] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

// Language names for UI
export const languageNames: Record<SupportedLanguage, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
};

// Level configuration (icons will be rendered using lucide-react in UI)
export const levelConfig = {
  iniciante: { minXp: 0, maxXp: 299, icon: "feather", name: "Iniciante" },
  explorador: { minXp: 300, maxXp: 899, icon: "book-open", name: "Explorador" },
  mentor: { minXp: 900, maxXp: 1999, icon: "brain", name: "Mentor" },
  mestre: { minXp: 2000, maxXp: Infinity, icon: "rocket", name: "Mestre do Foco" },
};

// Content Type enum
export const contentTypes = ["pdf", "docx", "pptx", "link"] as const;
export type ContentType = typeof contentTypes[number];

// Chat Mode enum
export const chatModes = ["study", "existential"] as const;
export type ChatMode = typeof chatModes[number];

// Subscription Plan enum
export const subscriptionPlans = ["free", "pro", "premium"] as const;
export type SubscriptionPlan = typeof subscriptionPlans[number];

// Subscription Status enum
export const subscriptionStatuses = ["active", "canceled", "past_due", "trialing"] as const;
export type SubscriptionStatus = typeof subscriptionStatuses[number];

// Plan limits configuration
export const planLimits = {
  free: {
    name: "Começa a Estudar",
    price: 0,
    uploadsPerMonth: 4,
    maxSubjects: 5,
    maxTopics: 10,
    maxSummaryWords: 1000,
    allowedLearningStyles: ["conciso", "visual"] as LearningStyle[],
    advancedFlashcards: false,
    chatModes: [] as ChatMode[],
    dailyChatLimit: 0,
    workspaces: 1,
    advancedStats: false,
    studyPlans: false,
    mindMaps: false,
    sharedSpaces: false,
    exportPdf: false,
  },
  pro: {
    name: "Estuda Sem Limites",
    price: 7.99,
    uploadsPerMonth: -1, // unlimited
    maxSubjects: -1,
    maxTopics: -1,
    maxSummaryWords: -1,
    allowedLearningStyles: ["visual", "logico", "conciso"] as LearningStyle[],
    advancedFlashcards: true,
    chatModes: [] as ChatMode[],
    dailyChatLimit: 0,
    workspaces: -1,
    advancedStats: false,
    studyPlans: false,
    mindMaps: false,
    sharedSpaces: false,
    exportPdf: false,
  },
  premium: {
    name: "Alta Performance",
    price: 18.99,
    uploadsPerMonth: -1,
    maxSubjects: -1,
    maxTopics: -1,
    maxSummaryWords: -1,
    allowedLearningStyles: ["visual", "logico", "conciso"] as LearningStyle[],
    advancedFlashcards: true,
    chatModes: ["study", "existential"] as ChatMode[],
    dailyChatLimit: -1,
    workspaces: -1,
    advancedStats: true,
    studyPlans: true,
    mindMaps: true,
    sharedSpaces: true,
    exportPdf: true,
  },
} as const;

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
  // Language preference (defaults to Portuguese)
  language: varchar("language", { length: 5 }).default("pt").notNull(),
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

// Subscriptions table
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    plan: varchar("plan", { length: 20 }).notNull().default("free"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    stripeCustomerId: varchar("stripe_customer_id"),
    stripeSubscriptionId: varchar("stripe_subscription_id"),
    stripePriceId: varchar("stripe_price_id"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_subscriptions_user_id").on(table.userId),
    index("idx_subscriptions_status").on(table.status),
  ],
);

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Usage Tracking table (for monthly limits)
export const usageTracking = pgTable(
  "usage_tracking",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM format
    uploadsCount: integer("uploads_count").default(0).notNull(),
    chatMessagesCount: integer("chat_messages_count").default(0).notNull(),
    summariesGenerated: integer("summaries_generated").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_usage_tracking_user_month").on(table.userId, table.month),
    uniqueIndex("idx_usage_tracking_user_month_unique").on(table.userId, table.month),
  ],
);

export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;

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

// Subjects table (Disciplinas)
export const subjects = pgTable(
  "subjects",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_subjects_user_id").on(table.userId),
    index("idx_subjects_user_position").on(table.userId, table.position),
  ],
);

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

// Topics table (Tópicos)
export const topics = pgTable(
  "topics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    subjectId: varchar("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_topics_subject_id").on(table.subjectId),
    index("idx_topics_user_id").on(table.userId),
    index("idx_topics_subject_position").on(table.subjectId, table.position),
  ],
);

export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topics.$inferSelect;

// Content Items table (generic container for PDFs, DOCX, PPTX, links)
export const contentItems = pgTable(
  "content_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    contentType: varchar("content_type", { length: 10 }).notNull(),
    title: text("title").notNull(),
    extractedText: text("extracted_text"),
    metadata: jsonb("metadata"),
    summaryId: varchar("summary_id").references(() => summaries.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_content_items_topic_id").on(table.topicId),
    index("idx_content_items_user_id").on(table.userId),
    index("idx_content_items_content_type").on(table.contentType),
    index("idx_content_items_summary_id").on(table.summaryId),
  ],
);

export const insertContentItemSchema = createInsertSchema(contentItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ContentItem = typeof contentItems.$inferSelect;

// Content Summaries table (maps content items to multiple summaries - one per learning style)
export const contentSummaries = pgTable(
  "content_summaries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    contentItemId: varchar("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    summaryId: varchar("summary_id").notNull().references(() => summaries.id, { onDelete: "cascade" }),
    learningStyle: varchar("learning_style", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      contentItemIdx: index("idx_content_summaries_content_item_id").on(table.contentItemId),
      summaryIdx: index("idx_content_summaries_summary_id").on(table.summaryId),
      learningStyleIdx: index("idx_content_summaries_learning_style").on(table.learningStyle),
      // Ensure one summary per learning style per content item
      uniqueContentStyle: uniqueIndex("idx_content_summaries_unique").on(table.contentItemId, table.learningStyle),
    };
  },
);

export const insertContentSummarySchema = createInsertSchema(contentSummaries).omit({
  id: true,
  createdAt: true,
});

export type InsertContentSummary = z.infer<typeof insertContentSummarySchema>;
export type ContentSummary = typeof contentSummaries.$inferSelect;

// Topic Summaries table (aggregated summaries of all content in a topic)
export const topicSummaries = pgTable(
  "topic_summaries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    learningStyle: varchar("learning_style", { length: 20 }).notNull(),
    language: varchar("language", { length: 5 }).default("pt").notNull(),
    summary: text("summary").notNull(),
    motivationalMessage: text("motivational_message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      topicIdx: index("idx_topic_summaries_topic_id").on(table.topicId),
      learningStyleIdx: index("idx_topic_summaries_learning_style").on(table.learningStyle),
      // Ensure one summary per learning style per topic per language
      uniqueTopicStyleLang: uniqueIndex("idx_topic_summaries_unique").on(table.topicId, table.learningStyle, table.language),
    };
  },
);

export const insertTopicSummarySchema = createInsertSchema(topicSummaries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTopicSummary = z.infer<typeof insertTopicSummarySchema>;
export type TopicSummary = typeof topicSummaries.$inferSelect;

// Content Assets table (file metadata for PDFs, DOCX, PPTX)
export const contentAssets = pgTable(
  "content_assets",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    contentItemId: varchar("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_content_assets_content_item_id").on(table.contentItemId),
  ],
);

export const insertContentAssetSchema = createInsertSchema(contentAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertContentAsset = z.infer<typeof insertContentAssetSchema>;
export type ContentAsset = typeof contentAssets.$inferSelect;

// Content Links table (web links/articles)
export const contentLinks = pgTable(
  "content_links",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    contentItemId: varchar("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_content_links_content_item_id").on(table.contentItemId),
  ],
);

export const insertContentLinkSchema = createInsertSchema(contentLinks).omit({
  id: true,
  createdAt: true,
});

export type InsertContentLink = z.infer<typeof insertContentLinkSchema>;
export type ContentLink = typeof contentLinks.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  summaries: many(summaries),
  studySessions: many(studySessions),
  flashcardAttempts: many(flashcardAttempts),
  xpEvents: many(xpEvents),
  chatThreads: many(chatThreads),
  subjects: many(subjects),
  topics: many(topics),
  contentItems: many(contentItems),
}));

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  user: one(users, {
    fields: [summaries.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
  studySessions: many(studySessions),
  contentItems: many(contentItems),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  user: one(users, {
    fields: [subjects.userId],
    references: [users.id],
  }),
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  user: one(users, {
    fields: [topics.userId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [topics.subjectId],
    references: [subjects.id],
  }),
  contentItems: many(contentItems),
  chatThreads: many(chatThreads),
}));

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  user: one(users, {
    fields: [contentItems.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [contentItems.topicId],
    references: [topics.id],
  }),
  summary: one(summaries, {
    fields: [contentItems.summaryId],
    references: [summaries.id],
  }),
  assets: many(contentAssets),
  links: many(contentLinks),
  summaries: many(contentSummaries),
}));

export const contentAssetsRelations = relations(contentAssets, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [contentAssets.contentItemId],
    references: [contentItems.id],
  }),
}));

export const contentLinksRelations = relations(contentLinks, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [contentLinks.contentItemId],
    references: [contentItems.id],
  }),
}));

export const contentSummariesRelations = relations(contentSummaries, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [contentSummaries.contentItemId],
    references: [contentItems.id],
  }),
  summary: one(summaries, {
    fields: [contentSummaries.summaryId],
    references: [summaries.id],
  }),
}));

// Flashcards table
export const flashcards = pgTable(
  "flashcards",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    summaryId: varchar("summary_id").references(() => summaries.id, { onDelete: "cascade" }),
    topicSummaryId: varchar("topic_summary_id").references(() => topicSummaries.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id").references(() => subjects.id, { onDelete: "cascade" }),
    topicId: varchar("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    isManual: boolean("is_manual").default(false).notNull(),
    language: varchar("language", { length: 5 }).default("pt").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_flashcards_user_id").on(table.userId),
    index("idx_flashcards_summary_id").on(table.summaryId),
    index("idx_flashcards_topic_summary_id").on(table.topicSummaryId),
    index("idx_flashcards_subject_id").on(table.subjectId),
    index("idx_flashcards_topic_id").on(table.topicId),
    index("idx_flashcards_is_manual").on(table.isManual),
  ],
);

export const insertFlashcardSchema = createInsertSchema(flashcards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for manual flashcard creation (PRO/PREMIUM only)
// IMPORTANT: subjectId and topicId are REQUIRED for manual flashcards
export const insertManualFlashcardSchema = insertFlashcardSchema.extend({
  isManual: z.literal(true),
  userId: z.string(),
  question: z.string().min(1, "Question is required").max(1000, "Question too long"),
  answer: z.string().min(1, "Answer is required").max(2000, "Answer too long"),
  language: z.enum(supportedLanguages),
  subjectId: z.string().min(1, "Subject is required"),
  topicId: z.string().min(1, "Topic is required"),
  summaryId: z.literal(null).optional(),
  topicSummaryId: z.literal(null).optional(),
});

// Schema for updating any flashcard (manual or auto-generated)
export const updateFlashcardSchema = z.object({
  question: z.string().min(1).max(1000).optional(),
  answer: z.string().min(1).max(2000).optional(),
  subjectId: z.string().nullable().optional(),
  topicId: z.string().nullable().optional(),
});

export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type InsertManualFlashcard = z.infer<typeof insertManualFlashcardSchema>;
export type UpdateFlashcard = z.infer<typeof updateFlashcardSchema>;
export type Flashcard = typeof flashcards.$inferSelect;

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  summary: one(summaries, {
    fields: [flashcards.summaryId],
    references: [summaries.id],
  }),
  attempts: many(flashcardAttempts),
}));

// Flashcard Translations table (maps flashcards across languages for shared SM-2 progress)
export const flashcardTranslations = pgTable(
  "flashcard_translations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    baseFlashcardId: varchar("base_flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
    translatedFlashcardId: varchar("translated_flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
    targetLanguage: varchar("target_language", { length: 5 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    baseFlashcardIdx: index("idx_flashcard_translations_base").on(table.baseFlashcardId),
    translatedFlashcardIdx: index("idx_flashcard_translations_translated").on(table.translatedFlashcardId),
    // Ensure one translation per language for each base flashcard
    uniqueBaseLanguage: uniqueIndex("idx_flashcard_translations_unique").on(table.baseFlashcardId, table.targetLanguage),
  }),
);

export const insertFlashcardTranslationSchema = createInsertSchema(flashcardTranslations).omit({
  id: true,
  createdAt: true,
});

export type InsertFlashcardTranslation = z.infer<typeof insertFlashcardTranslationSchema>;
export type FlashcardTranslation = typeof flashcardTranslations.$inferSelect;

export const flashcardTranslationsRelations = relations(flashcardTranslations, ({ one }) => ({
  baseFlashcard: one(flashcards, {
    fields: [flashcardTranslations.baseFlashcardId],
    references: [flashcards.id],
    relationName: "baseFlashcard",
  }),
  translatedFlashcard: one(flashcards, {
    fields: [flashcardTranslations.translatedFlashcardId],
    references: [flashcards.id],
    relationName: "translatedFlashcard",
  }),
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
    rating: integer("rating").notNull(),
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
}).extend({
  rating: z.number().int().min(1).max(4),
});

export type InsertFlashcardAttempt = z.infer<typeof insertFlashcardAttemptSchema>;
export type FlashcardAttempt = typeof flashcardAttempts.$inferSelect;

export const recordAttemptSchema = z.object({
  flashcardId: z.string(),
  rating: z.number().int().min(1).max(4),
});

export type RecordAttempt = z.infer<typeof recordAttemptSchema>;

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

// Chat Threads table (for dual-mode AI assistant conversations)
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 20 }).notNull().default("study"),
    topicId: varchar("topic_id").references(() => topics.id, { onDelete: "set null" }),
    title: text("title").default("Nova Conversa").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_chat_threads_user_id").on(table.userId),
    index("idx_chat_threads_user_mode").on(table.userId, table.mode, desc(table.lastActivityAt)),
    index("idx_chat_threads_topic_id").on(table.topicId, desc(table.lastActivityAt)),
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
  topic: one(topics, {
    fields: [chatThreads.topicId],
    references: [topics.id],
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

// Topic Study Time table (tracks time spent on topics for dashboard KPI)
export const topicStudyTime = pgTable(
  "topic_study_time",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    durationMinutes: integer("duration_minutes").default(0).notNull(),
    source: varchar("source", { length: 10 }).default("auto").notNull(), // 'auto' or 'manual'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_topic_study_time_user_id").on(table.userId),
    index("idx_topic_study_time_topic_id").on(table.topicId),
    index("idx_topic_study_time_user_started_at").on(table.userId, table.startedAt),
  ],
);

export const insertTopicStudyTimeSchema = createInsertSchema(topicStudyTime).omit({
  id: true,
  createdAt: true,
});

export type InsertTopicStudyTime = z.infer<typeof insertTopicStudyTimeSchema>;
export type TopicStudyTime = typeof topicStudyTime.$inferSelect;

// Topic Study Events table (enter/exit logs for resilience)
export const topicStudyEvents = pgTable(
  "topic_study_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id").references(() => topicStudyTime.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 10 }).notNull(), // 'enter' or 'exit'
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => [
    index("idx_topic_study_events_user_id").on(table.userId),
    index("idx_topic_study_events_topic_id").on(table.topicId),
    index("idx_topic_study_events_session_id").on(table.sessionId),
    index("idx_topic_study_events_timestamp").on(table.timestamp),
  ],
);

export const insertTopicStudyEventSchema = createInsertSchema(topicStudyEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertTopicStudyEvent = z.infer<typeof insertTopicStudyEventSchema>;
export type TopicStudyEvent = typeof topicStudyEvents.$inferSelect;

// Tasks table (user-created tasks)
export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    topicId: varchar("topic_id").references(() => topics.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: timestamp("due_date"),
    priority: varchar("priority", { length: 10 }).default("medium").notNull(), // 'low', 'medium', 'high'
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_tasks_user_id").on(table.userId),
    index("idx_tasks_subject_id").on(table.subjectId),
    index("idx_tasks_topic_id").on(table.topicId),
    index("idx_tasks_user_completed_at").on(table.userId, table.completedAt),
    index("idx_tasks_due_date").on(table.dueDate),
  ],
);

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Topic Progress table (tracks completed topics)
export const topicProgress = pgTable(
  "topic_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_topic_progress_user_id").on(table.userId),
    index("idx_topic_progress_topic_id").on(table.topicId),
    index("idx_topic_progress_subject_id").on(table.subjectId),
    uniqueIndex("idx_topic_progress_unique").on(table.userId, table.topicId),
  ],
);

export const insertTopicProgressSchema = createInsertSchema(topicProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTopicProgress = z.infer<typeof insertTopicProgressSchema>;
export type TopicProgress = typeof topicProgress.$inferSelect;

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

// Calendar Event Type enum
export const eventTypes = ["exam", "assignment"] as const;
export type EventType = typeof eventTypes[number];

// Calendar Events table
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    topicId: varchar("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    eventType: varchar("event_type", { length: 20 }).notNull(),
    eventDate: timestamp("event_date").notNull(),
    completed: boolean("completed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_calendar_events_user_id").on(table.userId),
    index("idx_calendar_events_subject_id").on(table.subjectId),
    index("idx_calendar_events_date").on(table.eventDate),
    index("idx_calendar_events_user_date").on(table.userId, table.eventDate),
  ],
);

export const insertCalendarEventSchema = createInsertSchema(calendarEvents, {
  eventType: z.enum(eventTypes),
  eventDate: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Flashcard Daily Metrics table (aggregated daily stats for Anki-style KPIs)
export const flashcardDailyMetrics = pgTable(
  "flashcard_daily_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
    cardsReviewed: integer("cards_reviewed").default(0).notNull(),
    cardsNew: integer("cards_new").default(0).notNull(),
    cardsCorrect: integer("cards_correct").default(0).notNull(),
    timeSpentMinutes: integer("time_spent_minutes").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_flashcard_daily_metrics_user_date").on(table.userId, table.date),
    index("idx_flashcard_daily_metrics_date").on(table.date),
  ],
);

export const insertFlashcardDailyMetricsSchema = createInsertSchema(flashcardDailyMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFlashcardDailyMetrics = z.infer<typeof insertFlashcardDailyMetricsSchema>;
export type FlashcardDailyMetrics = typeof flashcardDailyMetrics.$inferSelect;

// Flashcard Stats API types
export const flashcardHeatmapDataSchema = z.object({
  date: z.string(),
  cardsReviewed: z.number().int(),
  intensity: z.number().int().min(0).max(4), // 0-4 like GitHub contributions
});

export type FlashcardHeatmapData = z.infer<typeof flashcardHeatmapDataSchema>;

export const flashcardStatsSchema = z.object({
  dailyAverage: z.number(),
  daysLearned: z.number().int(),
  totalDays: z.number().int(),
  daysLearnedPercentage: z.number(),
  longestStreak: z.number().int(),
  currentStreak: z.number().int(),
  totalCardsReviewed: z.number().int(),
  heatmapData: z.array(flashcardHeatmapDataSchema),
});

export type FlashcardStats = z.infer<typeof flashcardStatsSchema>;

// ============================================
// SMART QUIZZES TABLES
// ============================================

// Quiz difficulty levels
export const quizDifficulties = ["easy", "medium", "hard"] as const;
export type QuizDifficulty = typeof quizDifficulties[number];

// Quizzes table - stores generated quizzes for topics
export const quizzes = pgTable(
  "quizzes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    language: varchar("language", { length: 5 }).default("pt").notNull(),
    difficulty: varchar("difficulty", { length: 10 }).default("medium").notNull(),
    questionCount: integer("question_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_quizzes_user_id").on(table.userId),
    index("idx_quizzes_topic_id").on(table.topicId),
    index("idx_quizzes_user_topic_lang").on(table.userId, table.topicId, table.language),
  ],
);

export const insertQuizSchema = createInsertSchema(quizzes, {
  difficulty: z.enum(quizDifficulties),
  language: z.enum(supportedLanguages),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

// Quiz Questions table - individual questions with multiple choice options
export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    options: jsonb("options").notNull(), // Array of {id: string, text: string}
    correctOptionId: varchar("correct_option_id", { length: 10 }).notNull(),
    explanation: text("explanation").notNull(), // Explanation for the correct answer
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_quiz_questions_quiz_id").on(table.quizId),
    index("idx_quiz_questions_position").on(table.quizId, table.position),
  ],
);

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({
  id: true,
  createdAt: true,
});

export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestions.$inferSelect;

// Quiz question option type
export const quizOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export type QuizOption = z.infer<typeof quizOptionSchema>;

// Quiz Attempts table - tracks user attempts on quizzes
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
    score: integer("score").notNull(), // Number of correct answers
    totalQuestions: integer("total_questions").notNull(),
    percentage: integer("percentage").notNull(), // 0-100
    timeSpentSeconds: integer("time_spent_seconds"),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_quiz_attempts_user_id").on(table.userId),
    index("idx_quiz_attempts_quiz_id").on(table.quizId),
    index("idx_quiz_attempts_user_quiz").on(table.userId, table.quizId),
  ],
);

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
  createdAt: true,
});

export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// Quiz Question Answers table - tracks individual question answers per attempt
export const quizQuestionAnswers = pgTable(
  "quiz_question_answers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    attemptId: varchar("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: varchar("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
    selectedOptionId: varchar("selected_option_id", { length: 10 }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_quiz_question_answers_attempt_id").on(table.attemptId),
    index("idx_quiz_question_answers_question_id").on(table.questionId),
  ],
);

export const insertQuizQuestionAnswerSchema = createInsertSchema(quizQuestionAnswers).omit({
  id: true,
  createdAt: true,
});

export type InsertQuizQuestionAnswer = z.infer<typeof insertQuizQuestionAnswerSchema>;
export type QuizQuestionAnswer = typeof quizQuestionAnswers.$inferSelect;

// Quiz relations
export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  user: one(users, {
    fields: [quizzes.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [quizzes.topicId],
    references: [topics.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
  answers: many(quizQuestionAnswers),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  answers: many(quizQuestionAnswers),
}));

export const quizQuestionAnswersRelations = relations(quizQuestionAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizQuestionAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(quizQuestions, {
    fields: [quizQuestionAnswers.questionId],
    references: [quizQuestions.id],
  }),
}));

// API types for quiz generation
export const generateQuizRequestSchema = z.object({
  topicId: z.string(),
  questionCount: z.number().int().min(3).max(20).default(10),
  difficulty: z.enum(quizDifficulties).default("medium"),
});

export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;

export const submitQuizAnswersSchema = z.object({
  quizId: z.string(),
  answers: z.array(z.object({
    questionId: z.string(),
    selectedOptionId: z.string(),
  })),
  timeSpentSeconds: z.number().int().optional(),
});

export type SubmitQuizAnswers = z.infer<typeof submitQuizAnswersSchema>;

export const quizResultSchema = z.object({
  attemptId: z.string(),
  score: z.number().int(),
  totalQuestions: z.number().int(),
  percentage: z.number().int(),
  results: z.array(z.object({
    questionId: z.string(),
    questionText: z.string(),
    selectedOptionId: z.string(),
    correctOptionId: z.string(),
    isCorrect: z.boolean(),
    explanation: z.string(),
    options: z.array(quizOptionSchema),
  })),
});

export type QuizResult = z.infer<typeof quizResultSchema>;
