import {
  users,
  summaries,
  flashcards,
  studySessions,
  flashcardAttempts,
  topicSummaries,
  topics,
  flashcardDailyMetrics,
  type User,
  type UpsertUser,
  type Summary,
  type InsertSummary,
  type Flashcard,
  type InsertFlashcard,
  type FlashcardAttempt,
  type InsertFlashcardAttempt,
  type TopicSummary,
  type StudySession,
  type InsertStudySession,
  type DashboardStats,
  type FlashcardDailyMetrics,
  type FlashcardStats,
  type FlashcardHeatmapData,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, count, sum, avg } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getOrCreateUser(id: string, claims: any): Promise<User>;
  updateUserLanguage(userId: string, language: string): Promise<User>;
  
  // Summary operations
  createSummary(summary: InsertSummary): Promise<Summary>;
  getSummary(id: string): Promise<Summary | undefined>;
  getUserSummaries(userId: string): Promise<Summary[]>;
  toggleFavorite(id: string, userId: string): Promise<Summary | undefined>;
  deleteSummary(id: string, userId: string): Promise<boolean>;
  
  // Flashcard operations
  createFlashcards(flashcardsData: InsertFlashcard[]): Promise<Flashcard[]>;
  createFlashcard(flashcardData: InsertFlashcard): Promise<Flashcard>;
  getUserFlashcards(userId: string, filters?: {
    subjectId?: string;
    topicId?: string;
    isManual?: boolean;
    language?: string;
  }): Promise<Flashcard[]>;
  getFlashcardsBySummary(summaryId: string): Promise<Flashcard[]>;
  getFlashcardsByTopicSummary(topicSummaryId: string): Promise<Flashcard[]>;
  countFlashcardsByTopicSummary(topicSummaryId: string): Promise<number>;
  getFlashcard(id: string): Promise<Flashcard | undefined>;
  updateFlashcard(id: string, userId: string, data: { question?: string; answer?: string }): Promise<Flashcard | null>;
  deleteFlashcard(id: string, userId: string): Promise<boolean>;
  getDueFlashcards(userId: string, summaryId: string): Promise<Flashcard[]>;
  getDueManualFlashcards(userId: string, filters?: { subjectId?: string; topicId?: string }): Promise<Flashcard[]>;
  
  // Flashcard attempt operations (Anki-style)
  createFlashcardAttempt(attempt: InsertFlashcardAttempt): Promise<FlashcardAttempt>;
  getLatestAttempt(userId: string, flashcardId: string): Promise<FlashcardAttempt | null>;
  
  // Topic summary operations
  getTopicSummary(id: string, userId: string): Promise<TopicSummary | null>;
  
  // Study session operations
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  getUserStudySessions(userId: string, limit?: number): Promise<StudySession[]>;
  
  // Dashboard statistics
  getDashboardStats(userId: string): Promise<DashboardStats>;
  
  // Flashcard statistics (Anki-style)
  getFlashcardStats(userId: string, daysBack?: number): Promise<FlashcardStats>;
  upsertFlashcardDailyMetrics(userId: string, date: string, cardsReviewed: number, isCorrect: boolean): Promise<FlashcardDailyMetrics>;
  getFlashcardDailyMetrics(userId: string, fromDate: string, toDate: string): Promise<FlashcardDailyMetrics[]>;
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

  async getOrCreateUser(id: string, claims: any): Promise<User> {
    const existing = await this.getUser(id);
    if (existing) {
      return existing;
    }

    return await this.upsertUser({
      id,
      email: claims.email || null,
      firstName: claims.first_name || null,
      lastName: claims.last_name || null,
      profileImageUrl: claims.profile_image_url || null,
    });
  }

  async updateUserLanguage(userId: string, language: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        language,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

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

  async createFlashcard(flashcardData: InsertFlashcard): Promise<Flashcard> {
    const [flashcard] = await db
      .insert(flashcards)
      .values(flashcardData)
      .returning();
    return flashcard;
  }

  async getUserFlashcards(
    userId: string,
    filters?: {
      subjectId?: string;
      topicId?: string;
      isManual?: boolean;
      language?: string;
    }
  ): Promise<Flashcard[]> {
    const conditions = [eq(flashcards.userId, userId)];

    if (filters?.subjectId) {
      conditions.push(eq(flashcards.subjectId, filters.subjectId));
    }
    if (filters?.topicId) {
      conditions.push(eq(flashcards.topicId, filters.topicId));
    }
    if (filters?.isManual !== undefined) {
      conditions.push(eq(flashcards.isManual, filters.isManual));
    }
    if (filters?.language) {
      conditions.push(eq(flashcards.language, filters.language));
    }

    return await db
      .select()
      .from(flashcards)
      .where(and(...conditions))
      .orderBy(desc(flashcards.createdAt));
  }

  async updateFlashcard(
    id: string,
    userId: string,
    data: { question?: string; answer?: string; subjectId?: string | null; topicId?: string | null }
  ): Promise<Flashcard | null> {
    const [updated] = await db
      .update(flashcards)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)))
      .returning();

    return updated || null;
  }

  async deleteFlashcard(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(flashcards)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)))
      .returning();

    return result.length > 0;
  }

  async getFlashcardsBySummary(summaryId: string): Promise<Flashcard[]> {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.summaryId, summaryId));
  }

  async getFlashcardsByTopicSummary(topicSummaryId: string): Promise<Flashcard[]> {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.topicSummaryId, topicSummaryId));
  }

  async countFlashcardsByTopicSummary(topicSummaryId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(flashcards)
      .where(eq(flashcards.topicSummaryId, topicSummaryId));
    return result[0]?.count || 0;
  }

  async getFlashcard(id: string): Promise<Flashcard | undefined> {
    const [flashcard] = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.id, id));
    return flashcard;
  }

  async getDueFlashcards(userId: string, summaryOrTopicSummaryId: string): Promise<Flashcard[]> {
    const now = new Date();
    
    console.log("[getDueFlashcards] Looking for summaryId:", summaryOrTopicSummaryId, "userId:", userId);
    
    const result = await db
      .select({
        flashcard: flashcards,
        attempt: flashcardAttempts,
      })
      .from(flashcards)
      .leftJoin(
        flashcardAttempts,
        and(
          eq(flashcards.id, flashcardAttempts.flashcardId),
          eq(flashcardAttempts.userId, userId)
        )
      )
      .where(
        sql`(${flashcards.summaryId} = ${summaryOrTopicSummaryId} OR ${flashcards.topicSummaryId} = ${summaryOrTopicSummaryId})`
      )
      .orderBy(flashcardAttempts.nextReviewDate);

    console.log("[getDueFlashcards] Total flashcards found:", result.length);
    if (result.length > 0) {
      console.log("[getDueFlashcards] First row:", {
        flashcardId: result[0].flashcard.id,
        hasAttempt: !!result[0].attempt,
        attemptId: result[0].attempt?.id,
      });
    }

    const dueCards = result.filter(row => {
      if (!row.attempt || !row.attempt.id) {
        console.log("[getDueFlashcards] Flashcard without attempt (NEW):", row.flashcard.id);
        return true;
      }
      const isDue = row.attempt.nextReviewDate && row.attempt.nextReviewDate <= now;
      console.log("[getDueFlashcards] Flashcard with attempt:", row.flashcard.id, "isDue:", isDue, "nextReview:", row.attempt.nextReviewDate);
      return isDue;
    });

    console.log("[getDueFlashcards] Due flashcards:", dueCards.length);
    return dueCards.map(row => row.flashcard);
  }

  async getDueManualFlashcards(
    userId: string,
    filters?: { subjectId?: string; topicId?: string }
  ): Promise<Flashcard[]> {
    const now = new Date();
    
    console.log("[getDueManualFlashcards] userId:", userId, "filters:", filters);
    
    // Build WHERE conditions for manual flashcards
    const whereConditions = [
      eq(flashcards.userId, userId),
      eq(flashcards.isManual, true),
    ];
    
    if (filters?.subjectId) {
      whereConditions.push(eq(flashcards.subjectId, filters.subjectId));
    }
    
    if (filters?.topicId) {
      whereConditions.push(eq(flashcards.topicId, filters.topicId));
    }
    
    const result = await db
      .select({
        flashcard: flashcards,
        attempt: flashcardAttempts,
      })
      .from(flashcards)
      .leftJoin(
        flashcardAttempts,
        and(
          eq(flashcards.id, flashcardAttempts.flashcardId),
          eq(flashcardAttempts.userId, userId)
        )
      )
      .where(and(...whereConditions))
      .orderBy(flashcardAttempts.nextReviewDate);

    console.log("[getDueManualFlashcards] Total manual flashcards found:", result.length);
    
    const dueCards = result.filter(row => {
      if (!row.attempt || !row.attempt.id) {
        console.log("[getDueManualFlashcards] Manual flashcard without attempt (NEW):", row.flashcard.id);
        return true;
      }
      const isDue = row.attempt.nextReviewDate && row.attempt.nextReviewDate <= now;
      console.log("[getDueManualFlashcards] Manual flashcard with attempt:", row.flashcard.id, "isDue:", isDue);
      return isDue;
    });

    console.log("[getDueManualFlashcards] Due manual flashcards:", dueCards.length);
    return dueCards.map(row => row.flashcard);
  }

  async createFlashcardAttempt(attemptData: InsertFlashcardAttempt): Promise<FlashcardAttempt> {
    const [attempt] = await db
      .insert(flashcardAttempts)
      .values(attemptData)
      .returning();
    return attempt;
  }

  async getLatestAttempt(userId: string, flashcardId: string): Promise<FlashcardAttempt | null> {
    const [attempt] = await db
      .select()
      .from(flashcardAttempts)
      .where(
        and(
          eq(flashcardAttempts.userId, userId),
          eq(flashcardAttempts.flashcardId, flashcardId)
        )
      )
      .orderBy(desc(flashcardAttempts.attemptDate))
      .limit(1);
    
    return attempt || null;
  }

  async getTopicSummary(id: string, userId: string): Promise<TopicSummary | null> {
    console.log("[getTopicSummary] Searching for:", { id, userId });
    const results = await db
      .select()
      .from(topicSummaries)
      .innerJoin(topics, eq(topicSummaries.topicId, topics.id))
      .where(
        and(
          eq(topicSummaries.id, id),
          eq(topics.userId, userId)
        )
      );
    
    console.log("[getTopicSummary] Results count:", results.length);
    if (results.length > 0) {
      console.log("[getTopicSummary] First result keys:", Object.keys(results[0]));
      console.log("[getTopicSummary] Has topic_summaries?", !!results[0].topic_summaries);
    }
    
    const [result] = results;
    const returnValue = result?.topic_summaries || null;
    console.log("[getTopicSummary] Returning:", returnValue ? "object" : "null");
    return returnValue;
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

    // Get list of studied PDFs with statistics
    const studiedPDFsData = await db
      .select({
        id: summaries.id,
        fileName: summaries.fileName,
        learningStyle: summaries.learningStyle,
        createdAt: summaries.createdAt,
        summaryId: studySessions.summaryId,
        studyDate: studySessions.studyDate,
        correctFlashcards: studySessions.correctFlashcards,
        incorrectFlashcards: studySessions.incorrectFlashcards,
      })
      .from(summaries)
      .leftJoin(studySessions, eq(summaries.id, studySessions.summaryId))
      .where(eq(summaries.userId, userId))
      .orderBy(desc(summaries.createdAt));

    // Aggregate stats per PDF
    const pdfStatsMap = new Map();
    studiedPDFsData.forEach((row) => {
      if (!pdfStatsMap.has(row.id)) {
        pdfStatsMap.set(row.id, {
          id: row.id,
          fileName: row.fileName,
          learningStyle: row.learningStyle,
          createdAt: row.createdAt.toISOString(),
          lastStudied: row.studyDate?.toISOString() || row.createdAt.toISOString(),
          totalSessions: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
        });
      }
      
      const stats = pdfStatsMap.get(row.id);
      if (row.summaryId && row.studyDate) {
        stats.totalSessions += 1;
        stats.totalCorrect += row.correctFlashcards || 0;
        stats.totalIncorrect += row.incorrectFlashcards || 0;
        
        // Update last studied if this session is more recent
        const currentLast = new Date(stats.lastStudied);
        const thisStudy = new Date(row.studyDate);
        if (thisStudy > currentLast) {
          stats.lastStudied = row.studyDate.toISOString();
        }
      }
    });

    const studiedPDFs = Array.from(pdfStatsMap.values()).map((pdf) => {
      const total = pdf.totalCorrect + pdf.totalIncorrect;
      return {
        id: pdf.id,
        fileName: pdf.fileName,
        learningStyle: pdf.learningStyle,
        lastStudied: pdf.lastStudied,
        totalSessions: pdf.totalSessions,
        averageAccuracy: total > 0 ? (pdf.totalCorrect / total) * 100 : 0,
        createdAt: pdf.createdAt,
      };
    });

    // Get recent study sessions with details
    const recentStudySessionsData = await db
      .select({
        id: studySessions.id,
        summaryId: studySessions.summaryId,
        studyDate: studySessions.studyDate,
        totalFlashcards: studySessions.totalFlashcards,
        correctFlashcards: studySessions.correctFlashcards,
        incorrectFlashcards: studySessions.incorrectFlashcards,
        fileName: summaries.fileName,
      })
      .from(studySessions)
      .innerJoin(summaries, eq(studySessions.summaryId, summaries.id))
      .where(eq(studySessions.userId, userId))
      .orderBy(desc(studySessions.studyDate))
      .limit(10);

    const recentStudySessions = recentStudySessionsData.map((session) => ({
      id: session.id,
      fileName: session.fileName,
      studyDate: session.studyDate.toISOString(),
      totalFlashcards: session.totalFlashcards,
      correctFlashcards: session.correctFlashcards,
      incorrectFlashcards: session.incorrectFlashcards,
      accuracy: session.totalFlashcards > 0 
        ? (session.correctFlashcards / session.totalFlashcards) * 100 
        : 0,
    }));

    return {
      totalPDFsStudied,
      totalFlashcardsCompleted,
      studyStreak,
      averageAccuracy,
      totalStudySessions: totalSessions,
      recentSessions,
      studiedPDFs,
      recentStudySessions,
    };
  }

  // Flashcard statistics (Anki-style)
  async upsertFlashcardDailyMetrics(
    userId: string, 
    date: string, 
    cardsReviewed: number, 
    isCorrect: boolean
  ): Promise<FlashcardDailyMetrics> {
    // Check if entry exists for this date
    const existing = await db
      .select()
      .from(flashcardDailyMetrics)
      .where(and(
        eq(flashcardDailyMetrics.userId, userId),
        eq(flashcardDailyMetrics.date, date)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing entry
      const [updated] = await db
        .update(flashcardDailyMetrics)
        .set({
          cardsReviewed: sql`${flashcardDailyMetrics.cardsReviewed} + ${cardsReviewed}`,
          cardsCorrect: isCorrect 
            ? sql`${flashcardDailyMetrics.cardsCorrect} + 1` 
            : flashcardDailyMetrics.cardsCorrect,
          updatedAt: new Date(),
        })
        .where(and(
          eq(flashcardDailyMetrics.userId, userId),
          eq(flashcardDailyMetrics.date, date)
        ))
        .returning();
      return updated;
    } else {
      // Create new entry
      const [created] = await db
        .insert(flashcardDailyMetrics)
        .values({
          userId,
          date,
          cardsReviewed,
          cardsCorrect: isCorrect ? 1 : 0,
        })
        .returning();
      return created;
    }
  }

  async getFlashcardDailyMetrics(
    userId: string, 
    fromDate: string, 
    toDate: string
  ): Promise<FlashcardDailyMetrics[]> {
    return await db
      .select()
      .from(flashcardDailyMetrics)
      .where(and(
        eq(flashcardDailyMetrics.userId, userId),
        gte(flashcardDailyMetrics.date, fromDate),
        lte(flashcardDailyMetrics.date, toDate)
      ))
      .orderBy(flashcardDailyMetrics.date);
  }

  async getFlashcardStats(userId: string, daysBack: number = 365): Promise<FlashcardStats> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysBack);
    
    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    
    // Get all daily metrics for the period
    const metrics = await this.getFlashcardDailyMetrics(userId, fromDate, toDate);
    
    // Calculate statistics
    const totalCardsReviewed = metrics.reduce((sum, m) => sum + m.cardsReviewed, 0);
    const daysLearned = metrics.filter(m => m.cardsReviewed > 0).length;
    const totalDays = daysBack;
    const dailyAverage = daysLearned > 0 ? Math.round(totalCardsReviewed / daysLearned) : 0;
    const daysLearnedPercentage = Math.round((daysLearned / totalDays) * 100);
    
    // Calculate streaks
    const { longestStreak, currentStreak } = this.calculateFlashcardStreaks(metrics, today);
    
    // Build heatmap data (last 365 days)
    const heatmapData = this.buildHeatmapData(metrics, daysBack, totalCardsReviewed);
    
    return {
      dailyAverage,
      daysLearned,
      totalDays,
      daysLearnedPercentage,
      longestStreak,
      currentStreak,
      totalCardsReviewed,
      heatmapData,
    };
  }

  private calculateFlashcardStreaks(
    metrics: FlashcardDailyMetrics[], 
    today: Date
  ): { longestStreak: number; currentStreak: number } {
    // Create a set of dates with activity
    const datesWithActivity = new Set(
      metrics.filter(m => m.cardsReviewed > 0).map(m => m.date)
    );
    
    if (datesWithActivity.size === 0) {
      return { longestStreak: 0, currentStreak: 0 };
    }
    
    // Calculate current streak
    let currentStreak = 0;
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    
    // Start from today or yesterday
    let checkDate = datesWithActivity.has(todayStr) ? today : 
                    datesWithActivity.has(yesterdayStr) ? yesterdayDate : null;
    
    if (checkDate) {
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (datesWithActivity.has(dateStr)) {
          currentStreak++;
          checkDate = new Date(checkDate);
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
    
    // Calculate longest streak
    const sortedDates = Array.from(datesWithActivity).sort();
    let longestStreak = 0;
    let currentRun = 1;
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentRun++;
      } else {
        longestStreak = Math.max(longestStreak, currentRun);
        currentRun = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentRun);
    
    return { longestStreak, currentStreak };
  }

  private buildHeatmapData(
    metrics: FlashcardDailyMetrics[], 
    daysBack: number,
    totalCards: number
  ): FlashcardHeatmapData[] {
    // Create a map of date -> cardsReviewed
    const metricsMap = new Map(metrics.map(m => [m.date, m.cardsReviewed]));
    
    // Calculate intensity thresholds based on max cards per day
    const maxCards = metrics.reduce((max, m) => Math.max(max, m.cardsReviewed), 1);
    
    const heatmapData: FlashcardHeatmapData[] = [];
    const today = new Date();
    
    for (let i = daysBack - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const cardsReviewed = metricsMap.get(dateStr) || 0;
      
      // Calculate intensity (0-4) based on cards reviewed
      let intensity = 0;
      if (cardsReviewed > 0) {
        const ratio = cardsReviewed / maxCards;
        if (ratio >= 0.75) intensity = 4;
        else if (ratio >= 0.5) intensity = 3;
        else if (ratio >= 0.25) intensity = 2;
        else intensity = 1;
      }
      
      heatmapData.push({
        date: dateStr,
        cardsReviewed,
        intensity,
      });
    }
    
    return heatmapData;
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
