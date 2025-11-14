import { db } from "./db";
import { classes, classEnrollments, users, type Class, type ClassEnrollment, type User } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createClass(teacherId: string, name: string, description?: string): Promise<Class> {
  let inviteCode = generateInviteCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await db
      .select()
      .from(classes)
      .where(eq(classes.inviteCode, inviteCode))
      .limit(1);

    if (existing.length === 0) {
      break;
    }

    inviteCode = generateInviteCode();
    attempts++;
  }

  if (attempts === maxAttempts) {
    throw new Error("Failed to generate unique invite code");
  }

  const [newClass] = await db
    .insert(classes)
    .values({
      teacherId,
      name,
      description: description || null,
      inviteCode,
    })
    .returning();

  return newClass;
}

export async function getTeacherClasses(teacherId: string): Promise<Class[]> {
  const teacherClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
    .orderBy(desc(classes.createdAt));

  return teacherClasses;
}

export async function getClassById(classId: string): Promise<Class | null> {
  const [classRecord] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  return classRecord || null;
}

export async function getClassByInviteCode(inviteCode: string): Promise<Class | null> {
  const [classRecord] = await db
    .select()
    .from(classes)
    .where(eq(classes.inviteCode, inviteCode))
    .limit(1);

  return classRecord || null;
}

export async function enrollStudent(classId: string, studentId: string): Promise<ClassEnrollment> {
  const existing = await db
    .select()
    .from(classEnrollments)
    .where(and(
      eq(classEnrollments.classId, classId),
      eq(classEnrollments.studentId, studentId)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Student already enrolled in this class");
  }

  const [enrollment] = await db
    .insert(classEnrollments)
    .values({
      classId,
      studentId,
    })
    .returning();

  return enrollment;
}

export async function getClassStudents(classId: string): Promise<User[]> {
  const enrollments = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      role: users.role,
      displayName: users.displayName,
      totalXp: users.totalXp,
      currentLevel: users.currentLevel,
      premiumActive: users.premiumActive,
      premiumSince: users.premiumSince,
      lastDailyChatXp: users.lastDailyChatXp,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(classEnrollments)
    .innerJoin(users, eq(classEnrollments.studentId, users.id))
    .where(eq(classEnrollments.classId, classId))
    .orderBy(desc(users.totalXp));

  return enrollments;
}

export async function getStudentClasses(studentId: string): Promise<Class[]> {
  const studentClasses = await db
    .select({
      id: classes.id,
      teacherId: classes.teacherId,
      name: classes.name,
      description: classes.description,
      inviteCode: classes.inviteCode,
      isActive: classes.isActive,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
    })
    .from(classEnrollments)
    .innerJoin(classes, eq(classEnrollments.classId, classes.id))
    .where(eq(classEnrollments.studentId, studentId))
    .orderBy(desc(classes.createdAt));

  return studentClasses;
}

export async function deleteClass(classId: string, teacherId: string): Promise<boolean> {
  const classRecord = await getClassById(classId);
  
  if (!classRecord) {
    throw new Error("Class not found");
  }
  
  if (classRecord.teacherId !== teacherId) {
    throw new Error("Not authorized to delete this class");
  }

  await db.delete(classes).where(eq(classes.id, classId));
  
  return true;
}

export async function removeStudent(classId: string, studentId: string, teacherId: string): Promise<boolean> {
  const classRecord = await getClassById(classId);
  
  if (!classRecord) {
    throw new Error("Class not found");
  }
  
  if (classRecord.teacherId !== teacherId) {
    throw new Error("Not authorized to remove students from this class");
  }

  await db
    .delete(classEnrollments)
    .where(and(
      eq(classEnrollments.classId, classId),
      eq(classEnrollments.studentId, studentId)
    ));
  
  return true;
}

export async function leaveClass(classId: string, studentId: string): Promise<boolean> {
  await db
    .delete(classEnrollments)
    .where(and(
      eq(classEnrollments.classId, classId),
      eq(classEnrollments.studentId, studentId)
    ));
  
  return true;
}
