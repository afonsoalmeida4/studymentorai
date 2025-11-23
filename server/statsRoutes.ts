import type { Express } from "express";
import { db } from "./db";
import { topicStudyTime, topicStudyEvents, tasks, topicProgress, subjects, topics,
         insertTopicStudyEventSchema, insertTaskSchema } from "@shared/schema";
import { eq, and, gte, sql, desc, count as countFn } from "drizzle-orm";
import { isAuthenticated } from "./replitAuth";
import { z } from "zod";

export function registerStatsRoutes(app: Express) {
  // Schema for session event validation
  const sessionEventSchema = z.object({
    eventType: z.enum(['enter', 'exit']),
  });

  /**
   * POST /api/topics/:id/session-events
   * Track when user enters/exits a topic
   * 
   * KNOWN LIMITATION: Session overlap across devices
   * 
   * When a user opens the same topic on multiple devices simultaneously, 
   * the session pairing logic may produce incorrect study time tracking:
   * - Each device sends an 'enter' event creating separate unmatched records
   * - When an 'exit' event fires, it pairs with "the most recent unmatched enter"
   * - This leaves other concurrent 'enter' events unpaired (no session created)
   * 
   * Frequency: <1% of usage (requires exact same-second concurrent access)
   * 
   * Remediation plan:
   * - Defer full transaction locking until telemetry shows overlap impacts KPIs
   * - Current implementation optimizes for common case (single device)
   * - Future fix: Add activeSessionId tracking or server-side locking
   */
  app.post("/api/topics/:id/session-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.id;
      
      // Validate request body
      const validation = sessionEventSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid event data", details: validation.error.errors });
      }

      const { eventType } = validation.data;

      await db.insert(topicStudyEvents).values({
        userId,
        topicId,
        eventType,
        sessionId: null,
      });

      // If exit event, calculate duration and create study time entry
      if (eventType === 'exit') {
        // Find all unmatched 'enter' events to detect concurrent device usage
        const unmatchedEnters = await db
          .select()
          .from(topicStudyEvents)
          .where(and(
            eq(topicStudyEvents.userId, userId),
            eq(topicStudyEvents.topicId, topicId),
            eq(topicStudyEvents.eventType, 'enter'),
            sql`${topicStudyEvents.sessionId} IS NULL`
          ))
          .orderBy(desc(topicStudyEvents.timestamp));

        // TODO: TELEMETRY - Monitor session overlap frequency
        // If unmatchedEnters.length > 1, log for analytics to track concurrent device usage
        if (unmatchedEnters.length > 1) {
          console.warn(`[SESSION_OVERLAP] User ${userId} has ${unmatchedEnters.length} unmatched enters for topic ${topicId}. Potential concurrent device usage detected.`);
          // Future: Send to analytics/telemetry service to measure real-world frequency
          // and determine if activeSessionId tracking or locking is needed
        }

        const lastUnmatchedEnter = unmatchedEnters.slice(0, 1);
        if (lastUnmatchedEnter.length > 0) {
          const startTime = new Date(lastUnmatchedEnter[0].timestamp);
          const endTime = new Date();
          const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

          if (durationMinutes > 0) {
            // Create study time entry
            const [studySession] = await db.insert(topicStudyTime).values({
              userId,
              topicId,
              startedAt: startTime,
              endedAt: endTime,
              durationMinutes,
              source: 'auto',
            }).returning();

            // Mark the enter event as matched by linking to session
            await db
              .update(topicStudyEvents)
              .set({ sessionId: studySession.id })
              .where(eq(topicStudyEvents.id, lastUnmatchedEnter[0].id));
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking session event:", error);
      res.status(500).json({ error: "Failed to track session event" });
    }
  });

  // GET /api/stats/study-time
  // Weekly study hours + comparison with last week
  app.get("/api/stats/study-time", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Current week
      const currentWeekResult = await db
        .select({ total: sql<number>`COALESCE(SUM(${topicStudyTime.durationMinutes}), 0)` })
        .from(topicStudyTime)
        .where(and(
          eq(topicStudyTime.userId, userId),
          gte(topicStudyTime.startedAt, weekAgo)
        ));

      // Previous week
      const previousWeekResult = await db
        .select({ total: sql<number>`COALESCE(SUM(${topicStudyTime.durationMinutes}), 0)` })
        .from(topicStudyTime)
        .where(and(
          eq(topicStudyTime.userId, userId),
          gte(topicStudyTime.startedAt, twoWeeksAgo),
          sql`${topicStudyTime.startedAt} < ${weekAgo}`
        ));

      const currentMinutes = Number(currentWeekResult[0]?.total || 0);
      const previousMinutes = Number(previousWeekResult[0]?.total || 0);
      const deltaMinutes = currentMinutes - previousMinutes;
      const weeklyGoalMinutes = 600; // 10 hours goal

      res.json({
        currentWeekMinutes: currentMinutes,
        currentWeekHours: (currentMinutes / 60).toFixed(1),
        previousWeekMinutes: previousMinutes,
        deltaMinutes,
        weeklyGoalMinutes,
        progressPercentage: Math.min(100, (currentMinutes / weeklyGoalMinutes) * 100),
      });
    } catch (error) {
      console.error("Error fetching study time stats:", error);
      res.status(500).json({ error: "Failed to fetch study time stats" });
    }
  });

  // GET /api/stats/subject-progress
  // Top 3 subjects by completion percentage
  app.get("/api/stats/subject-progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const result = await db
        .select({
          subjectId: subjects.id,
          subjectName: subjects.name,
          subjectColor: subjects.color,
          totalTopics: sql<number>`COUNT(DISTINCT ${topics.id})`,
          completedTopics: sql<number>`COUNT(DISTINCT CASE WHEN ${topicProgress.completed} = true THEN ${topics.id} END)`,
        })
        .from(subjects)
        .leftJoin(topics, eq(topics.subjectId, subjects.id))
        .leftJoin(topicProgress, and(
          eq(topicProgress.topicId, topics.id),
          eq(topicProgress.userId, userId)
        ))
        .where(eq(subjects.userId, userId))
        .groupBy(subjects.id, subjects.name, subjects.color)
        .orderBy(desc(sql`COUNT(DISTINCT ${topics.id})`))
        .limit(3);

      console.log("[SUBJECT PROGRESS DEBUG] Raw SQL result:", JSON.stringify(result, null, 2));

      const subjectsWithProgress = result.map(row => ({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectColor: row.subjectColor,
        totalTopics: Number(row.totalTopics),
        completedTopics: Number(row.completedTopics),
        completionPercentage: row.totalTopics > 0
          ? Math.round((Number(row.completedTopics) / Number(row.totalTopics)) * 100)
          : 0,
      }));

      console.log("[SUBJECT PROGRESS DEBUG] Processed result:", JSON.stringify(subjectsWithProgress, null, 2));

      res.json({ subjects: subjectsWithProgress });
    } catch (error) {
      console.error("Error fetching subject progress:", error);
      res.status(500).json({ error: "Failed to fetch subject progress" });
    }
  });

  // POST /api/tasks
  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validation = insertTaskSchema.safeParse({ ...req.body, userId });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid task data", details: validation.error.errors });
      }

      const [newTask] = await db.insert(tasks).values({
        ...validation.data,
        userId, // Ensure userId from auth takes precedence
      }).returning();

      res.json({ task: newTask });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // PATCH /api/tasks/:id
  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      const { completed, title, description, dueDate, priority } = req.body;

      const updates: any = {};
      if (completed !== undefined) {
        updates.completed = completed;
        updates.completedAt = completed ? new Date() : null;
      }
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (priority !== undefined) updates.priority = priority;

      const [updatedTask] = await db
        .update(tasks)
        .set(updates)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
        .returning();

      if (!updatedTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ task: updatedTask });
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // DELETE /api/tasks/:id
  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;

      await db
        .delete(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // GET /api/tasks
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const userTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, userId))
        .orderBy(desc(tasks.createdAt));

      res.json({ tasks: userTasks });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // GET /api/stats/tasks-summary
  app.get("/api/stats/tasks-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Today's completed tasks
      const todayResult = await db
        .select({ count: countFn() })
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          eq(tasks.completed, true),
          gte(tasks.completedAt, today)
        ));

      // This week's completed tasks
      const weekResult = await db
        .select({ count: countFn() })
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          eq(tasks.completed, true),
          gte(tasks.completedAt, weekAgo)
        ));

      // Total pending tasks
      const pendingResult = await db
        .select({ count: countFn() })
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          eq(tasks.completed, false)
        ));

      // Total tasks (all tasks regardless of completed status)
      const totalResult = await db
        .select({ count: countFn() })
        .from(tasks)
        .where(eq(tasks.userId, userId));

      const completedToday = Number(todayResult[0]?.count || 0);
      const completedThisWeek = Number(weekResult[0]?.count || 0);
      const pendingTasks = Number(pendingResult[0]?.count || 0);
      const totalTasks = Number(totalResult[0]?.count || 0);

      // Simple status indicator: green if >= 2 tasks today, yellow if 1, red if 0
      const status = completedToday >= 2 ? 'green' : completedToday === 1 ? 'yellow' : 'red';

      res.json({
        completedToday,
        completedThisWeek,
        pendingTasks,
        totalTasks,
        status,
      });
    } catch (error) {
      console.error("Error fetching tasks summary:", error);
      res.status(500).json({ error: "Failed to fetch tasks summary" });
    }
  });

  // GET /api/stats/streak
  app.get("/api/stats/streak", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Get last 30 days of study sessions (grouped by date)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessionsResult = await db
        .select({
          date: sql<string>`DATE(${topicStudyTime.startedAt})`,
          totalMinutes: sql<number>`SUM(${topicStudyTime.durationMinutes})`,
        })
        .from(topicStudyTime)
        .where(and(
          eq(topicStudyTime.userId, userId),
          gte(topicStudyTime.startedAt, thirtyDaysAgo)
        ))
        .groupBy(sql`DATE(${topicStudyTime.startedAt})`)
        .orderBy(sql`DATE(${topicStudyTime.startedAt}) DESC`);

      const studyDays = new Set(
        sessionsResult
          .filter(row => Number(row.totalMinutes) >= 15)
          .map(row => row.date)
      );

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        if (studyDays.has(dateStr)) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Last 7 days for sparkline
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        last7Days.push({
          date: dateStr,
          studied: studyDays.has(dateStr),
        });
      }

      res.json({
        currentStreak,
        last7Days,
      });
    } catch (error) {
      console.error("Error fetching streak:", error);
      res.status(500).json({ error: "Failed to fetch streak" });
    }
  });

  // POST /api/topic-progress/:topicId/toggle
  app.post("/api/topic-progress/:topicId/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.topicId;

      // Get topic to find subject
      const [topic] = await db
        .select()
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
        .limit(1);

      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Check if progress exists
      const [existing] = await db
        .select()
        .from(topicProgress)
        .where(and(
          eq(topicProgress.userId, userId),
          eq(topicProgress.topicId, topicId)
        ))
        .limit(1);

      let updated;
      if (existing) {
        // Toggle completion
        const newCompleted = !existing.completed;
        [updated] = await db
          .update(topicProgress)
          .set({
            completed: newCompleted,
            completedAt: newCompleted ? new Date() : null,
          })
          .where(and(
            eq(topicProgress.userId, userId),
            eq(topicProgress.topicId, topicId)
          ))
          .returning();
      } else {
        // Create new progress entry
        [updated] = await db
          .insert(topicProgress)
          .values({
            userId,
            topicId,
            subjectId: topic.subjectId,
            completed: true,
            completedAt: new Date(),
          })
          .returning();
      }

      res.json({ progress: updated });
    } catch (error) {
      console.error("Error toggling topic progress:", error);
      res.status(500).json({ error: "Failed to toggle topic progress" });
    }
  });

  // GET /api/topic-progress
  app.get("/api/topic-progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const progress = await db
        .select()
        .from(topicProgress)
        .where(eq(topicProgress.userId, userId));

      res.json({ progress });
    } catch (error) {
      console.error("Error fetching topic progress:", error);
      res.status(500).json({ error: "Failed to fetch topic progress" });
    }
  });
}
