import { cache } from "react";
import { Role } from "@prisma/client";
import { hasActiveEnrollment } from "@/features/courses/queries";
import { db } from "@/lib/db";
import { toEmbed, type VideoEmbed } from "@/lib/video/provider";
import { canEnterCourse } from "@/features/admin/curriculum";
import { canAccessLesson, courseProgress, lessonNeighbors } from "@/features/learning/progress";

export const getLearnCourseFrame = cache(async function getLearnCourseFrame(input: {
  courseSlug: string;
  userId: string | null;
  role: Role | null;
}) {
  const course = await db.course.findUnique({
    where: { slug: input.courseSlug },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      modules: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          lessons: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              slug: true,
              durationSeconds: true,
              position: true,
              isPreview: true,
            },
          },
        },
      },
    },
  });

  if (!course) return null;

  const enrolled = input.userId ? await hasActiveEnrollment(input.userId, course.id) : false;
  if (
    !canEnterCourse({
      status: course.status,
      enrolled,
      isAdmin: input.role === Role.ADMIN,
    })
  ) {
    return null;
  }

  const flat = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, module })));
  const published = course.status === "PUBLISHED";
  const canWatchLesson = (isPreview: boolean) =>
    canAccessLesson({ role: input.role, enrolled, isPreview, published });

  const lessonIds = flat.map((lesson) => lesson.id);
  const progressRows =
    input.userId && lessonIds.length > 0
      ? await db.lessonProgress.findMany({
          where: { userId: input.userId, lessonId: { in: lessonIds } },
          select: { lessonId: true, completed: true, lastPosition: true },
        })
      : [];
  const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));
  const progress = courseProgress(flat.map((lesson) => ({ completed: Boolean(progressByLesson.get(lesson.id)?.completed) })));

  return {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      percent: progress.percent,
      completedLessons: progress.completed,
      lessonCount: flat.length,
    },
    enrolled,
    modules: course.modules.map((module) => {
      const done = module.lessons.filter((lesson) => progressByLesson.get(lesson.id)?.completed).length;
      return {
        id: module.id,
        title: module.title,
        position: module.position,
        lessonCount: module.lessons.length,
        completedCount: done,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          durationSeconds: lesson.durationSeconds,
          position: lesson.position,
          isPreview: lesson.isPreview,
          completed: Boolean(progressByLesson.get(lesson.id)?.completed),
          locked: !canWatchLesson(lesson.isPreview),
          lastPosition: progressByLesson.get(lesson.id)?.lastPosition ?? 0,
          moduleId: module.id,
          moduleTitle: module.title,
          modulePosition: module.position,
        })),
      };
    }),
  };
});

export const getLearningSession = cache(async function getLearningSession(input: {
  courseSlug: string;
  lessonSlug: string;
  userId: string | null;
  role: Role | null;
}) {
  const frame = await getLearnCourseFrame(input);
  if (!frame) return null;

  const flat = frame.modules.flatMap((module) => module.lessons);
  const current = flat.find((lesson) => lesson.slug === input.lessonSlug);
  if (!current) return null;

  const canWatch = !current.locked;
  let playback: VideoEmbed | null = null;
  let hasVideo = false;
  let description = "";
  let resources: { id: string; title: string; url: string; kind: string }[] = [];

  if (canWatch) {
    const full = await db.lesson.findUnique({
      where: { id: current.id },
      select: {
        description: true,
        videoProvider: true,
        videoRef: true,
        resources: {
          orderBy: { position: "asc" },
          select: { id: true, title: true, url: true, kind: true },
        },
      },
    });
    description = full?.description ?? "";
    resources = (full?.resources ?? []).filter((resource) => resource.url.startsWith("https://"));
    hasVideo = Boolean(full?.videoRef);
    if (full?.videoRef) {
      playback = toEmbed({ provider: full.videoProvider, ref: full.videoRef });
    }
  }

  const neighbors = lessonNeighbors(
    flat.map((lesson) => ({
      slug: lesson.slug,
      title: lesson.title,
      position: lesson.position,
      moduleTitle: lesson.moduleTitle,
      modulePosition: lesson.modulePosition,
    })),
    current.slug,
  );

  return {
    course: frame.course,
    enrolled: frame.enrolled,
    modules: frame.modules,
    lesson: {
      id: current.id,
      title: current.title,
      slug: current.slug,
      description,
      durationSeconds: current.durationSeconds,
      position: current.position,
      isPreview: current.isPreview,
      moduleId: current.moduleId,
      moduleTitle: current.moduleTitle,
      modulePosition: current.modulePosition,
      completed: current.completed,
      lastPosition: current.lastPosition,
    },
    playback,
    hasVideo,
    resources,
    canWatch,
    previous: neighbors.previous,
    next: neighbors.next,
  };
});

export type LearningSession = NonNullable<Awaited<ReturnType<typeof getLearningSession>>>;
export type LearnCourseFrame = NonNullable<Awaited<ReturnType<typeof getLearnCourseFrame>>>;
