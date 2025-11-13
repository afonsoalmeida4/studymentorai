import {
  users,
  summaries,
  flashcards,
  studySessions,
  type User,
  type UpsertUser,
  type Summary,
  type InsertSummary,
  type Flashcard,
  type InsertFlashcard,
  type StudySession,
  type InsertStudySession,
  type DashboardStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, count, sum, avg } from "drizzle-orm";

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
  
  // Flashcard operations
  createFlashcards(flashcardsData: InsertFlashcard[]): Promise<Flashcard[]>;
  getFlashcardsBySummary(summaryId: string): Promise<Flashcard[]>;
  
  // Study session operations
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  getUserStudySessions(userId: string, limit?: number): Promise<StudySession[]>;
  
  // Dashboard statistics
  getDashboardStats(userId: string): Promise<DashboardStats>;
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

  // Flashcard operations
  async createFlashcards(flashcardsData: InsertFlashcard[]): Promise<Flashcard[]> {
    const result = await db
      .insert(flashcards)
      .values(flashcardsData)
      .returning();
    return result;
  }

  async getFlashcardsBySummary(summaryId: string): Promise<Flashcard[]> {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.summaryId, summaryId));
  }

  // Study session operations
  async createStudySession(sessionData: InsertStudySession): Promise<StudySession> {
    const [session] = await db
      .insert(studySessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async getUserStudySessions(userId: string, limit: number = 30): Promise<StudySession[]> {
    return await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .orderBy(desc(studySessions.studyDate))
      .limit(limit);
  }

  // Dashboard statistics
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    // Get total number of unique PDFs studied
    const pdfsResult = await db
      .select({ count: count() })
      .from(summaries)
      .where(eq(summaries.userId, userId));
    const totalPDFsStudied = pdfsResult[0]?.count || 0;

    // Get total flashcards completed and accuracy
    const sessionsResult = await db
      .select({
        totalSessions: count(),
        totalCorrect: sum(studySessions.correctFlashcards),
        totalIncorrect: sum(studySessions.incorrectFlashcards),
      })
      .from(studySessions)
      .where(eq(studySessions.userId, userId));

    const totalSessions = sessionsResult[0]?.totalSessions || 0;
    const totalCorrect = Number(sessionsResult[0]?.totalCorrect || 0);
    const totalIncorrect = Number(sessionsResult[0]?.totalIncorrect || 0);
    const totalFlashcardsCompleted = totalCorrect + totalIncorrect;
    const averageAccuracy = totalFlashcardsCompleted > 0
      ? (totalCorrect / totalFlashcardsCompleted) * 100
      : 0;

    // Calculate study streak
    const sessions = await this.getUserStudySessions(userId, 365);
    const studyStreak = this.calculateStreak(sessions);

    // Get recent sessions for chart (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSessionsData = await db
      .select({
        studyDate: studySessions.studyDate,
        correctFlashcards: studySessions.correctFlashcards,
        incorrectFlashcards: studySessions.incorrectFlashcards,
      })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          gte(studySessions.studyDate, sevenDaysAgo)
        )
      )
      .orderBy(studySessions.studyDate);

    const recentSessions = recentSessionsData.map((session) => {
      const correct = session.correctFlashcards || 0;
      const incorrect = session.incorrectFlashcards || 0;
      const total = correct + incorrect;
      return {
        date: session.studyDate.toISOString().split('T')[0],
        flashcardsCompleted: total,
        accuracy: total > 0 ? (correct / total) * 100 : 0,
      };
    });

    return {
      totalPDFsStudied,
      totalFlashcardsCompleted,
      studyStreak,
      averageAccuracy,
      totalStudySessions: totalSessions,
      recentSessions,
    };
  }

  // Helper method to calculate study streak
  private calculateStreak(sessions: StudySession[]): number {
    if (sessions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get unique study dates (normalized to day)
    const studyDates = sessions.map((s) => {
      const date = new Date(s.studyDate);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });
    const uniqueDates = Array.from(new Set(studyDates)).sort((a, b) => b - a);

    // Check if today or yesterday is included (streak is active)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const hasToday = uniqueDates.some(d => d === today.getTime());
    const hasYesterday = uniqueDates.some(d => d === yesterday.getTime());
    
    if (!hasToday && !hasYesterday) {
      return 0; // Streak is broken
    }

    // Count consecutive days
    let streak = 0;
    let expectedDate = hasToday ? today.getTime() : yesterday.getTime();

    for (const dateTime of uniqueDates) {
      if (dateTime === expectedDate) {
        streak++;
        expectedDate -= 24 * 60 * 60 * 1000; // Move to previous day
      } else if (dateTime < expectedDate) {
        break; // Gap found
      }
    }

    return streak;
  }
}

export const storage = new DatabaseStorage();
