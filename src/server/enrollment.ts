import { EnrollmentSource, Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type EnrollmentWriter = PrismaClient | Prisma.TransactionClient;

export type GrantEnrollmentResult =
  | { outcome: "granted" }
  | { outcome: "already_enrolled" };

/**
 * Creates an enrollment or restores a cancelled one.
 * An active or completed enrollment is left unchanged.
 */
export async function grantEnrollment(
  input: {
    userId: string;
    courseId: string;
    source?: EnrollmentSource;
    externalPaymentId?: string | null;
  },
  writer: EnrollmentWriter = db,
): Promise<GrantEnrollmentResult> {
  const existing = await writer.enrollment.findUnique({
    where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    select: { id: true, status: true },
  });

  if (existing && (existing.status === "ACTIVE" || existing.status === "COMPLETED")) {
    return { outcome: "already_enrolled" };
  }

  if (existing) {
    await writer.enrollment.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        source: input.source ?? "MANUAL",
        enrolledAt: new Date(),
        completedAt: null,
        ...(input.externalPaymentId ? { externalPaymentId: input.externalPaymentId } : {}),
      },
    });
    return { outcome: "granted" };
  }

  try {
    await writer.enrollment.create({
      data: {
        userId: input.userId,
        courseId: input.courseId,
        status: "ACTIVE",
        source: input.source ?? "MANUAL",
        externalPaymentId: input.externalPaymentId ?? null,
      },
    });
    return { outcome: "granted" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { outcome: "already_enrolled" };
    }
    throw error;
  }
}

export async function syncCourseCompletion(userId: string, courseId: string) {
  const lessons = await db.lesson.findMany({
    where: { courseId, archivedAt: null, module: { archivedAt: null } },
    select: { id: true },
  });
  if (lessons.length === 0) return;
  const completed = await db.lessonProgress.count({
    where: {
      userId,
      completed: true,
      lessonId: { in: lessons.map((lesson) => lesson.id) },
    },
  });
  if (completed < lessons.length) return false;
  const updated = await db.enrollment.updateMany({
    where: { userId, courseId, status: "ACTIVE" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return updated.count > 0;
}

export async function reopenCourseEnrollment(userId: string, courseId: string) {
  await db.enrollment.updateMany({
    where: { userId, courseId, status: "COMPLETED" },
    data: { status: "ACTIVE", completedAt: null },
  });
}
