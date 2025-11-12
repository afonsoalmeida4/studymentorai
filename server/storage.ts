import {
  users,
  summaries,
  type User,
  type UpsertUser,
  type Summary,
  type InsertSummary,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Summary operations
  createSummary(summary: InsertSummary): Promise<Summary>;
  getSummary(id: string): Promise<Summary | undefined>;
  getUserSummaries(userId: string): Promise<Summary[]>;
  toggleFavorite(id: string, userId: string): Promise<Summary | undefined>;
  deleteSummary(id: string, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Summary operations
  async createSummary(summaryData: InsertSummary): Promise<Summary> {
    const [summary] = await db
      .insert(summaries)
      .values(summaryData)
      .returning();
    return summary;
  }

  async getSummary(id: string): Promise<Summary | undefined> {
    const [summary] = await db
      .select()
      .from(summaries)
      .where(eq(summaries.id, id));
    return summary;
  }

  async getUserSummaries(userId: string): Promise<Summary[]> {
    return await db
      .select()
      .from(summaries)
      .where(eq(summaries.userId, userId))
      .orderBy(desc(summaries.createdAt));
  }

  async toggleFavorite(id: string, userId: string): Promise<Summary | undefined> {
    const summary = await this.getSummary(id);
    if (!summary || summary.userId !== userId) {
      return undefined;
    }

    const [updated] = await db
      .update(summaries)
      .set({ isFavorite: !summary.isFavorite })
      .where(and(eq(summaries.id, id), eq(summaries.userId, userId)))
      .returning();
    
    return updated;
  }

  async deleteSummary(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(summaries)
      .where(and(eq(summaries.id, id), eq(summaries.userId, userId)))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
