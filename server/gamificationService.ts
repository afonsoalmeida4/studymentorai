import { db } from "./db";
import { users, xpEvents, type User, type XpEvent, type InsertXpEvent, type XpAction } from "@shared/schema";
import { XP_REWARDS, getLevelFromXP } from "@shared/gamification";
import { eq, desc, sql } from "drizzle-orm";

export interface AwardXPResult {
  xpAwarded: number;
  totalXp: number;
  leveledUp: boolean;
  previousLevel: string;
  currentLevel: string;
  levelInfo: ReturnType<typeof getLevelFromXP>;
}

export interface GamificationProfile {
  user: User;
  levelInfo: ReturnType<typeof getLevelFromXP>;
  recentXpEvents: XpEvent[];
  rank: number | null;
  totalUsers: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  totalXp: number;
  currentLevel: string;
  rank: number;
}

/**
 * Award XP to a user for a specific action
 */
export async function awardXP(
  userId: string,
  action: XpAction,
  metadata?: Record<string, any>
): Promise<AwardXPResult> {
  // Get current user
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) {
    throw new Error("User not found");
  }

  const previousLevel = user.currentLevel;
  const previousXp = user.totalXp;

  // Calculate XP to award based on action
  let xpToAward = 0;
  
  switch (action) {
    case "upload_pdf":
      xpToAward = XP_REWARDS.UPLOAD_PDF;
      break;
    case "generate_summary":
      xpToAward = XP_REWARDS.GENERATE_SUMMARY;
      break;
    case "create_flashcards":
      xpToAward = XP_REWARDS.CREATE_FLASHCARDS;
      break;
    case "answer_flashcard":
      // Base XP + bonus for correct answers
      const flashcardIsCorrect = metadata?.isCorrect || false;
      xpToAward = XP_REWARDS.ANSWER_FLASHCARD + 
                  (flashcardIsCorrect ? XP_REWARDS.ANSWER_FLASHCARD_CORRECT_BONUS : 0);
      break;
    case "complete_study_session":
      // Base + bonus for correct cards
      const correctCards = metadata?.correctCards || 0;
      xpToAward = XP_REWARDS.COMPLETE_STUDY_SESSION_BASE + 
                  (correctCards * XP_REWARDS.CORRECT_FLASHCARD_BONUS);
      break;
    case "daily_streak_bonus":
      xpToAward = XP_REWARDS.DAILY_STREAK_BONUS;
      break;
    case "daily_chat_interaction":
      xpToAward = XP_REWARDS.DAILY_CHAT_INTERACTION;
      break;
    case "level_up_bonus":
      xpToAward = XP_REWARDS.LEVEL_UP_BONUS;
      break;
    default:
      xpToAward = 0;
  }

  // Record XP event
  await db.insert(xpEvents).values({
    userId,
    action,
    xpAwarded: xpToAward,
    metadata: metadata || null,
  });

  // Update user's total XP
  const newTotalXp = previousXp + xpToAward;
  const newLevelInfo = getLevelFromXP(newTotalXp);

  await db
    .update(users)
    .set({
      totalXp: newTotalXp,
      currentLevel: newLevelInfo.level,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Check if leveled up
  const leveledUp = newLevelInfo.level !== previousLevel;

  // Award bonus XP if leveled up
  if (leveledUp) {
    await db.insert(xpEvents).values({
      userId,
      action: "level_up_bonus",
      xpAwarded: XP_REWARDS.LEVEL_UP_BONUS,
      metadata: {
        previousLevel,
        newLevel: newLevelInfo.level,
      },
    });

    // Update total XP again with bonus
    await db
      .update(users)
      .set({
        totalXp: newTotalXp + XP_REWARDS.LEVEL_UP_BONUS,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  return {
    xpAwarded: xpToAward + (leveledUp ? XP_REWARDS.LEVEL_UP_BONUS : 0),
    totalXp: newTotalXp + (leveledUp ? XP_REWARDS.LEVEL_UP_BONUS : 0),
    leveledUp,
    previousLevel,
    currentLevel: newLevelInfo.level,
    levelInfo: getLevelFromXP(newTotalXp + (leveledUp ? XP_REWARDS.LEVEL_UP_BONUS : 0)),
  };
}

/**
 * Get gamification profile for a user
 */
export async function getGamificationProfile(userId: string): Promise<GamificationProfile> {
  // Get user
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) {
    throw new Error("User not found");
  }

  // Get level info
  const levelInfo = getLevelFromXP(user.totalXp);

  // Get recent XP events (last 20)
  const recentXpEvents = await db
    .select()
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .orderBy(desc(xpEvents.createdAt))
    .limit(20);

  // Calculate rank
  const rankResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`total_xp > ${user.totalXp}`);
  
  const rank = (rankResult[0]?.count || 0) + 1;

  // Get total users count
  const totalUsersResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  
  const totalUsers = totalUsersResult[0]?.count || 0;

  return {
    user,
    levelInfo,
    recentXpEvents,
    rank,
    totalUsers,
  };
}

/**
 * Get leaderboard (top users by XP)
 */
export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const topUsers = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      totalXp: users.totalXp,
      currentLevel: users.currentLevel,
    })
    .from(users)
    .orderBy(desc(users.totalXp))
    .limit(limit);

  return topUsers.map((user, index) => ({
    ...user,
    rank: index + 1,
  }));
}

/**
 * Activate premium for a user
 */
export async function activatePremium(userId: string): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({
      premiumActive: true,
      premiumSince: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!updatedUser) {
    throw new Error("Failed to activate premium");
  }

  return updatedUser;
}

/**
 * Check if user can receive daily chat XP (once per day)
 */
export async function canReceiveDailyChatXP(userId: string): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) {
    return false;
  }

  if (!user.lastDailyChatXp) {
    return true;
  }

  const lastChatXpDate = new Date(user.lastDailyChatXp);
  const now = new Date();
  
  // Check if it's a different day
  return (
    lastChatXpDate.getDate() !== now.getDate() ||
    lastChatXpDate.getMonth() !== now.getMonth() ||
    lastChatXpDate.getFullYear() !== now.getFullYear()
  );
}

/**
 * Mark that user received daily chat XP today
 */
export async function markDailyChatXPReceived(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      lastDailyChatXp: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
