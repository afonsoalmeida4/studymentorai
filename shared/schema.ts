import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Learning style enum
export const learningStyles = ["visual", "auditivo", "logico", "conciso"] as const;
export type LearningStyle = typeof learningStyles[number];

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
}));

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  user: one(users, {
    fields: [summaries.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
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

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  summary: one(summaries, {
    fields: [flashcards.summaryId],
    references: [summaries.id],
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
