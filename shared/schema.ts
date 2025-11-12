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

export const summariesRelations = relations(summaries, ({ one }) => ({
  user: one(users, {
    fields: [summaries.userId],
    references: [users.id],
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
