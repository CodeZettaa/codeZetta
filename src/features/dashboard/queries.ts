import { cache } from "react";
import { pickContinueLesson, selectContinueCourse } from "@/features/enrollment/continue";
import { completionPercent } from "@/features/learning/progress";
import { db } from "@/lib/db";

export type DashboardCourse = {
  title: string;
  slug: string;
  thumbnail: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  status: "ACTIVE" | "COMPLETED";
  started: boolean;
  percent: number;
  completedLessons: number;
  lessonCount: number;
  enrolledAt: Date;
  lastAccessedAt: Date;
  continueLesson: {
    slug: string;
    title: string;
    moduleTitle: string;
    modulePosition: number;
  } | null;
  lastActivity: {
    at: Date;
    lessonTitle: string;
    moduleTitle: string;
  } | null;
};

export const getStudentDashboard = cache(async (userId: string) => {
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { enrolledAt: "desc" },
    select: {
      status: true,
      enrolledAt: true,
      course: {
        select: {
          title: true,
          slug: true,
          thumbnail: true,
          level: true,
          modules: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: {
              title: true,
              position: true,
              lessons: {
                where: { archivedAt: null },
                orderBy: { position: "asc" },
                select: { id: true, slug: true, title: true, position: true },
              },
            },
          },
        },
      },
    },
  });

  const lessonIds = enrollments.flatMap((enrollment) =>
    enrollment.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)),
  );

  const progressRows =
    lessonIds.length === 0
      ? []
      : await db.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          orderBy: { lastWatchedAt: "desc" },
          select: {
            lessonId: true,
            completed: true,
            lastWatchedAt: true,
            lesson: {
              select: {
                title: true,
                slug: true,
                module: {
                  select: {
                    title: true,
                    position: true,
                    course: { select: { title: true, slug: true } },
                  },
                },
              },
            },
          },
        });

  const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));

  const courses: DashboardCourse[] = enrollments.map((enrollment) => {
    const lessons = enrollment.course.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        position: lesson.position,
        moduleTitle: module.title,
        modulePosition: module.position,
      })),
    );
    const marks = lessons.flatMap((lesson) => {
      const row = progressByLesson.get(lesson.id);
      return row ? [{ lessonId: lesson.id, completed: row.completed, lastWatchedAt: row.lastWatchedAt }] : [];
    });
    const completedLessons = marks.filter((row) => row.completed).length;
    const next = pickContinueLesson(lessons, marks);
    const last = [...marks].sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime())[0];
    const lastLesson = last ? lessons.find((lesson) => lesson.id === last.lessonId) : null;

    return {
      title: enrollment.course.title,
      slug: enrollment.course.slug,
      thumbnail: enrollment.course.thumbnail,
      level: enrollment.course.level,
      status: enrollment.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
      started: marks.length > 0,
      percent: completionPercent(completedLessons, lessons.length),
      completedLessons,
      lessonCount: lessons.length,
      enrolledAt: enrollment.enrolledAt,
      lastAccessedAt: last?.lastWatchedAt ?? enrollment.enrolledAt,
      continueLesson: next
        ? {
            slug: next.slug,
            title: next.title,
            moduleTitle: next.moduleTitle,
            modulePosition: next.modulePosition,
          }
        : null,
      lastActivity: last && lastLesson
        ? {
            at: last.lastWatchedAt,
            lessonTitle: lastLesson.title,
            moduleTitle: lastLesson.moduleTitle,
          }
        : null,
    };
  });

  const recentlyWatched = progressRows.slice(0, 4).map((row) => ({
    title: row.lesson.title,
    lessonSlug: row.lesson.slug,
    moduleTitle: row.lesson.module.title,
    modulePosition: row.lesson.module.position,
    courseTitle: row.lesson.module.course.title,
    courseSlug: row.lesson.module.course.slug,
    completed: row.completed,
    lastWatchedAt: row.lastWatchedAt,
  }));

  const continueTarget = selectContinueCourse(courses);

  return {
    courses,
    recentlyWatched,
    continueTarget,
    completedCourses: courses.filter((course) => course.percent === 100 || course.status === "COMPLETED"),
    inProgress: courses.filter((course) => course.percent < 100 && course.status !== "COMPLETED"),
  };
});
