"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEnterCourse } from "@/features/admin/curriculum";
import { hasActiveEnrollment } from "@/features/courses/queries";
import { recordLearningEvent } from "@/features/learning/events";
import {
  MAX_PLAYBACK_SECONDS,
  MAX_WATCH_CREDIT_SECONDS,
  acceptPlaybackWrite,
  clampPlayback,
  courseProgress,
  creditWatchTime,
  lessonNeighbors,
  moduleProgress,
} from "@/features/learning/progress";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/authz";
import { reopenCourseEnrollment, syncCourseCompletion } from "@/server/enrollment";

const positionSchema = z.object({
  lessonId: z.string().trim().min(1).max(64),
  positionSeconds: z.number().finite().min(0).max(MAX_PLAYBACK_SECONDS),
  observedAt: z.number().int().positive(),
  playedSeconds: z.number().finite().min(0).max(MAX_WATCH_CREDIT_SECONDS * 4).optional(),
  seek: z.boolean().optional(),
  reset: z.boolean().optional(),
});

const SESSION_EXPIRED = "Your session has expired. Sign in again to continue.";

async function lessonAccess(lessonId: string, userId: string, role: "STUDENT" | "ADMIN") {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      slug: true,
      position: true,
      courseId: true,
      durationSeconds: true,
      isPreview: true,
      archivedAt: true,
      course: {
        select: {
          slug: true,
          title: true,
          status: true,
          lessons: {
            where: { archivedAt: null, module: { archivedAt: null } },
            select: {
              id: true,
              slug: true,
              title: true,
              position: true,
              module: { select: { id: true, title: true, position: true } },
            },
          },
        },
      },
      module: { select: { id: true, title: true, position: true } },
    },
  });
  if (!lesson || (lesson.archivedAt && role !== "ADMIN")) {
    return { error: "This lesson isn't available right now." as const };
  }

  const enrolled = await hasActiveEnrollment(userId, lesson.courseId);
  if (!canEnterCourse({ status: lesson.course.status, enrolled, isAdmin: role === "ADMIN" })) {
    return { error: "This lesson isn't available right now." as const };
  }
  const canWatch = role === "ADMIN" || enrolled || (lesson.course.status === "PUBLISHED" && lesson.isPreview);
  if (!canWatch) return { error: "You don't have access to this course." as const };
  return { lesson, enrolled };
}

function sequence(lesson: {
  course: {
    lessons: {
      slug: string;
      title: string;
      position: number;
      module: { title: string; position: number };
    }[];
  };
}) {
  return lesson.course.lessons.map((item) => ({
    slug: item.slug,
    title: item.title,
    position: item.position,
    moduleTitle: item.module.title,
    modulePosition: item.module.position,
  }));
}

function refreshLearning(courseSlug: string, lessonSlug: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/learn/${courseSlug}/${lessonSlug}`);
}

export async function updatePlaybackProgress(input: unknown) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: SESSION_EXPIRED, code: "unauthorized" as const };
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That playback position isn't valid.", code: "invalid" as const };

  const now = Date.now();
  if (parsed.data.observedAt > now + 15_000 || parsed.data.observedAt < now - 24 * 60 * 60 * 1000) {
    return { ok: false as const, error: "That playback position isn't valid.", code: "invalid" as const };
  }

  const lesson = await db.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: {
      id: true,
      slug: true,
      courseId: true,
      durationSeconds: true,
      isPreview: true,
      archivedAt: true,
      course: { select: { slug: true, status: true } },
    },
  });
  if (!lesson || lesson.archivedAt) {
    return { ok: false as const, error: "This lesson isn't available right now.", code: "forbidden" as const };
  }
  const enrolled = await hasActiveEnrollment(user.id, lesson.courseId);
  if (!canEnterCourse({ status: lesson.course.status, enrolled, isAdmin: user.role === "ADMIN" })) {
    return { ok: false as const, error: "This lesson isn't available right now.", code: "forbidden" as const };
  }
  const canWatch = user.role === "ADMIN" || enrolled || (lesson.course.status === "PUBLISHED" && lesson.isPreview);
  if (!canWatch) return { ok: false as const, error: "You don't have access to this course.", code: "forbidden" as const };
  if (!enrolled || user.role === "ADMIN") {
    return { ok: true as const, skipped: true as const, justCompleted: false };
  }

  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    select: { watchedSeconds: true, lastPosition: true, lastWatchedAt: true, completed: true },
  });

  const reset = Boolean(parsed.data.reset);
  const position = reset ? 0 : clampPlayback(parsed.data.positionSeconds, lesson.durationSeconds);
  if (position == null) return { ok: false as const, error: "That playback position isn't valid.", code: "invalid" as const };
  if (!reset && position <= 0) return { ok: true as const, skipped: true as const, justCompleted: false };

  const accept = acceptPlaybackWrite({
    incomingPosition: position,
    incomingAt: parsed.data.observedAt,
    storedPosition: existing?.lastPosition ?? null,
    storedAt: existing?.lastWatchedAt.getTime() ?? null,
    seek: reset || Boolean(parsed.data.seek),
  });
  if (!accept) return { ok: true as const, skipped: true as const, justCompleted: false };

  const sampledAt = new Date(Math.min(parsed.data.observedAt, now));
  const wallSeconds = existing
    ? Math.max(0, (sampledAt.getTime() - existing.lastWatchedAt.getTime()) / 1000)
    : MAX_WATCH_CREDIT_SECONDS;
  const credited = creditWatchTime({
    storedWatched: existing?.watchedSeconds ?? 0,
    storedPosition: existing?.lastPosition ?? null,
    incomingPosition: position,
    playedSeconds: parsed.data.playedSeconds ?? 0,
    wallSeconds,
    durationSeconds: lesson.durationSeconds,
    reset,
    alreadyCompleted: Boolean(existing?.completed),
  });

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    create: {
      userId: user.id,
      lessonId: lesson.id,
      lastPosition: credited.lastPosition,
      watchedSeconds: credited.watchedSeconds,
      lastWatchedAt: sampledAt,
      completed: credited.completed,
      completedAt: credited.completed ? new Date() : null,
    },
    update: {
      lastPosition: credited.lastPosition,
      watchedSeconds: credited.watchedSeconds,
      lastWatchedAt: sampledAt,
      ...(credited.completed && !existing?.completed ? { completed: true, completedAt: new Date() } : {}),
    },
  });

  if (!existing) {
    const earlier = await db.lessonProgress.count({
      where: {
        userId: user.id,
        lesson: { courseId: lesson.courseId },
        NOT: { lessonId: lesson.id },
      },
    });
    if (earlier === 0) {
      recordLearningEvent({ type: "course_started", userId: user.id, courseId: lesson.courseId });
    }
    recordLearningEvent({
      type: "lesson_started",
      userId: user.id,
      courseId: lesson.courseId,
      lessonId: lesson.id,
    });
  }

  let justCompleted = false;
  if (credited.completed && !existing?.completed) {
    justCompleted = true;
    recordLearningEvent({
      type: "lesson_completed",
      userId: user.id,
      courseId: lesson.courseId,
      lessonId: lesson.id,
    });
    const courseDone = await syncCourseCompletion(user.id, lesson.courseId);
    if (courseDone) {
      recordLearningEvent({ type: "course_completed", userId: user.id, courseId: lesson.courseId });
    }
    refreshLearning(lesson.course.slug, lesson.slug);
  }

  return { ok: true as const, skipped: false as const, justCompleted };
}

type AccessibleLesson = Extract<Awaited<ReturnType<typeof lessonAccess>>, { lesson: unknown }>["lesson"];

async function completionResult(userId: string, lesson: AccessibleLesson) {
  const ordered = sequence(lesson);
  const neighbors = lessonNeighbors(ordered, lesson.slug);
  const moduleLessons = lesson.course.lessons.filter((item) => item.module.id === lesson.module.id);
  const moduleIds = moduleLessons.map((item) => item.id);
  const completedRows = await db.lessonProgress.findMany({
    where: { userId, completed: true, lessonId: { in: lesson.course.lessons.map((item) => item.id) } },
    select: { lessonId: true },
  });
  const completedIds = new Set(completedRows.map((row) => row.lessonId));
  const moduleDone = moduleProgress(moduleLessons.map((item) => ({ completed: completedIds.has(item.id) })));
  const courseDone = courseProgress(lesson.course.lessons.map((item) => ({ completed: completedIds.has(item.id) })));
  const nextModule =
    neighbors.next && neighbors.next.modulePosition !== lesson.module.position ? neighbors.next : null;

  return {
    moduleCompleted: moduleIds.length > 0 && moduleDone.completed >= moduleDone.total,
    moduleTitle: lesson.module.title,
    courseCompleted: courseDone.total > 0 && courseDone.completed >= courseDone.total,
    courseTitle: lesson.course.title,
    next: neighbors.next,
    nextModule,
  };
}

export async function markLessonCompleted(lessonId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: SESSION_EXPIRED };
  const parsed = z.string().trim().min(1).max(64).safeParse(lessonId);
  if (!parsed.success) return { ok: false as const, error: "This lesson isn't available right now." };

  const access = await lessonAccess(parsed.data, user.id, user.role);
  if ("error" in access) return { ok: false as const, error: access.error };
  if (user.role === "ADMIN") {
    return { ok: true as const, ...(await completionResult(user.id, access.lesson)) };
  }

  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId: parsed.data } },
    select: { watchedSeconds: true, lastPosition: true, completed: true, completedAt: true },
  });

  if (!existing?.completed) {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: parsed.data } },
      create: {
        userId: user.id,
        lessonId: parsed.data,
        completed: true,
        completedAt: new Date(),
        lastPosition: existing?.lastPosition ?? 0,
        watchedSeconds: existing?.watchedSeconds ?? 0,
      },
      update: {
        completed: true,
        completedAt: existing?.completedAt ?? new Date(),
        lastWatchedAt: new Date(),
      },
    });
    recordLearningEvent({
      type: "lesson_completed",
      userId: user.id,
      courseId: access.lesson.courseId,
      lessonId: parsed.data,
    });
    const courseDone = await syncCourseCompletion(user.id, access.lesson.courseId);
    if (courseDone) {
      recordLearningEvent({ type: "course_completed", userId: user.id, courseId: access.lesson.courseId });
    }
    refreshLearning(access.lesson.course.slug, access.lesson.slug);
  }

  return { ok: true as const, ...(await completionResult(user.id, access.lesson)) };
}

export async function markLessonComplete(lessonId: string) {
  return markLessonCompleted(lessonId);
}

export async function markLessonIncomplete(lessonId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: SESSION_EXPIRED };
  const parsed = z.string().trim().min(1).max(64).safeParse(lessonId);
  if (!parsed.success) return { ok: false as const, error: "This lesson isn't available right now." };

  const access = await lessonAccess(parsed.data, user.id, user.role);
  if ("error" in access) return { ok: false as const, error: access.error };
  if (user.role === "ADMIN") return { ok: true as const };

  await db.lessonProgress.updateMany({
    where: { userId: user.id, lessonId: parsed.data },
    data: { completed: false, completedAt: null },
  });
  await reopenCourseEnrollment(user.id, access.lesson.courseId);
  refreshLearning(access.lesson.course.slug, access.lesson.slug);
  return { ok: true as const };
}
