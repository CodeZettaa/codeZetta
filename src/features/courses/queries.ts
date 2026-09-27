import { cache } from "react";
import { Prisma } from "@prisma/client";
import { pickContinueLesson } from "@/features/enrollment/continue";
import { completionPercent } from "@/features/learning/progress";
import { db } from "@/lib/db";

const courseCardSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  level: true,
  priceCents: true,
  originalPriceCents: true,
  currency: true,
  durationSeconds: true,
  technologies: true,
  featured: true,
  _count: {
    select: {
      modules: { where: { archivedAt: null } },
      lessons: { where: { archivedAt: null, module: { archivedAt: null } } },
      projects: true,
    },
  },
} satisfies Prisma.CourseSelect;

const publicLessonSelect = {
  id: true,
  title: true,
  slug: true,
  durationSeconds: true,
  position: true,
  isPreview: true,
} satisfies Prisma.LessonSelect;

function assertPublicLesson(lesson: object) {
  if ("videoRef" in lesson || "videoProvider" in lesson) {
    throw new Error("Public lesson query included a video field.");
  }
}

export const getPublishedCourses = cache(async () => {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
    select: courseCardSelect,
  });
  return courses;
});

export const getFeaturedCourses = cache(async () => {
  const featured = await db.course.findMany({
    where: { status: "PUBLISHED", featured: true },
    orderBy: { createdAt: "asc" },
    select: courseCardSelect,
  });
  if (featured.length > 0) return featured;
  return getPublishedCourses();
});

export const getPublishedCourse = cache(async (slug: string, includeUnpublished = false) => {
  const course = await db.course.findFirst({
    where: includeUnpublished ? { slug } : { slug, status: "PUBLISHED" },
    select: {
      id: true,
      status: true,
      title: true,
      slug: true,
      description: true,
      level: true,
      priceCents: true,
      originalPriceCents: true,
      currency: true,
      durationSeconds: true,
      technologies: true,
      outcomes: true,
      requirements: true,
        modules: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          lessons: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: publicLessonSelect,
          },
        },
      },
      projects: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
        },
      },
      resources: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          url: true,
        },
      },
    },
  });

  course?.modules.forEach((module) => {
    module.lessons.forEach((lesson) => assertPublicLesson(lesson));
  });

  return course;
});

export const getCourseProgressBySlug = cache(async (userId: string) => {
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: {
      course: {
        select: {
          slug: true,
          lessons: {
            where: { archivedAt: null, module: { archivedAt: null } },
            select: { id: true, slug: true, position: true, module: { select: { position: true } } },
          },
        },
      },
    },
  });

  const lessonIds = enrollments.flatMap((enrollment) => enrollment.course.lessons.map((lesson) => lesson.id));
  const rows = lessonIds.length
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true, completed: true, lastWatchedAt: true },
      })
    : [];
  const marksByLesson = new Map(rows.map((row) => [row.lessonId, row]));

  const bySlug: Record<string, { percent: number; continueLessonSlug: string | null; started: boolean }> = {};
  for (const enrollment of enrollments) {
    const lessons = enrollment.course.lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.slug,
      position: lesson.position,
      moduleTitle: "",
      modulePosition: lesson.module.position,
    }));
    const marks = lessons.flatMap((lesson) => {
      const row = marksByLesson.get(lesson.id);
      return row ? [{ lessonId: lesson.id, completed: row.completed, lastWatchedAt: row.lastWatchedAt }] : [];
    });
    const done = marks.filter((row) => row.completed).length;
    const next = pickContinueLesson(lessons, marks);
    bySlug[enrollment.course.slug] = {
      percent: completionPercent(done, lessons.length),
      continueLessonSlug: next?.slug ?? null,
      started: marks.length > 0,
    };
  }
  return bySlug;
});

export async function getEnrollmentStatus(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });
  return enrollment?.status ?? null;
}

export async function hasActiveEnrollment(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });
  return enrollment?.status === "ACTIVE" || enrollment?.status === "COMPLETED";
}

export type CourseCard = Awaited<ReturnType<typeof getPublishedCourses>>[number];
export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getPublishedCourse>>>;
