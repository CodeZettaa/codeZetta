import { cache } from "react";
import { db } from "@/lib/db";

export type ContinueLesson = {
  id: string;
  slug: string;
  title: string;
  moduleTitle: string;
  modulePosition: number;
};

type ProgressMark = {
  lessonId: string;
  completed: boolean;
  lastWatchedAt: Date;
};

type OrderedLesson = ContinueLesson & { position: number };

/**
 * Next lesson for one enrollment.
 * 1. The most recently watched lesson that is still incomplete.
 * 2. The first incomplete lesson in curriculum order.
 * 3. The first lesson, when the course has not been started.
 */
export function pickContinueLesson(lessons: OrderedLesson[], progress: ProgressMark[]): ContinueLesson | null {
  if (lessons.length === 0) return null;
  const ordered = [...lessons].sort((a, b) => {
    if (a.modulePosition !== b.modulePosition) return a.modulePosition - b.modulePosition;
    return a.position - b.position;
  });
  const byId = new Map(ordered.map((lesson) => [lesson.id, lesson]));
  const lastIncomplete = [...progress]
    .filter((row) => !row.completed && byId.has(row.lessonId))
    .sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime())[0];
  if (lastIncomplete) return byId.get(lastIncomplete.lessonId) ?? null;

  const completed = new Set(progress.filter((row) => row.completed).map((row) => row.lessonId));
  return ordered.find((lesson) => !completed.has(lesson.id)) ?? ordered[0] ?? null;
}

export const getContinueLearningLesson = cache(async (userId: string, courseId: string) => {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });
  if (!enrollment || (enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED")) {
    return null;
  }

  const lessons = await db.lesson.findMany({
    where: { courseId, archivedAt: null, module: { archivedAt: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      position: true,
      module: { select: { title: true, position: true } },
    },
  });
  const ordered: OrderedLesson[] = lessons.map((lesson) => ({
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    position: lesson.position,
    moduleTitle: lesson.module.title,
    modulePosition: lesson.module.position,
  }));
  const progress = await db.lessonProgress.findMany({
    where: { userId, lessonId: { in: ordered.map((lesson) => lesson.id) } },
    select: { lessonId: true, completed: true, lastWatchedAt: true },
  });

  const lesson = pickContinueLesson(ordered, progress);
  const completedLessons = progress.filter((row) => row.completed).length;
  const last = [...progress].sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime())[0];
  const lastLesson = last ? ordered.find((item) => item.id === last.lessonId) : null;

  return {
    lesson,
    completedLessons,
    lessonCount: ordered.length,
    percent: ordered.length === 0 ? 0 : Math.round((completedLessons / ordered.length) * 100),
    started: progress.length > 0,
    lastActivity: last && lastLesson
      ? {
          at: last.lastWatchedAt,
          lessonTitle: lastLesson.title,
          moduleTitle: lastLesson.moduleTitle,
        }
      : null,
  };
});

export type ContinueTargetCourse = {
  status: "ACTIVE" | "COMPLETED";
  percent: number;
  lastAccessedAt: Date;
  continueLesson: { slug: string } | null;
};

/**
 * The course a student should resume.
 * Phase 3 can replace the progress marks that feed `percent` and `lastAccessedAt`
 * without changing this choice.
 */
export function selectContinueCourse<T extends ContinueTargetCourse>(courses: T[]): T | null {
  return (
    [...courses]
      .filter((course) => course.status === "ACTIVE" && course.percent < 100 && course.continueLesson)
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())[0] ?? null
  );
}

/** Lesson to resume inside one course. Dashboard, course pages, and the player share this. */
export const getContinueLearningTarget = getContinueLearningLesson;
