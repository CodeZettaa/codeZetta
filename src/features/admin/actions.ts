"use server";

import { CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  centsFromDollars,
  courseInputSchema,
  enrollSchema,
  lessonInputSchema,
  lines,
  listFromCommas,
  moduleTitleSchema,
  resourceSchema,
} from "@/features/admin/schemas";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { detectVideo } from "@/lib/video/provider";
import { insertBefore, publishIssues } from "@/features/admin/curriculum";
import { grantEnrollment } from "@/server/enrollment";
import { requireAdmin } from "@/server/authz";
import { logServerError } from "@/server/log";

function courseData(input: z.infer<typeof courseInputSchema>) {
  const priceCents = centsFromDollars(input.price);
  const originalPriceCents = input.originalPrice.trim() ? centsFromDollars(input.originalPrice) : null;
  if (priceCents === null || originalPriceCents === null) return null;
  return {
    title: input.title,
    description: input.description,
    level: input.level,
    status: input.status,
    featured: input.featured,
    priceCents,
    originalPriceCents: originalPriceCents && originalPriceCents > 0 ? originalPriceCents : null,
    technologies: listFromCommas(input.technologies),
    outcomes: lines(input.outcomes),
    requirements: lines(input.requirements),
    currency: input.currency,
    thumbnail: input.thumbnail || null,
  };
}

function readCourseForm(formData: FormData) {
  return courseInputSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    description: formData.get("description"),
    level: formData.get("level"),
    price: formData.get("price") ?? "0",
    originalPrice: formData.get("originalPrice") ?? "",
    technologies: formData.get("technologies") ?? "",
    outcomes: formData.get("outcomes") ?? "",
    requirements: formData.get("requirements") ?? "",
    featured: formData.get("featured") === "on",
    status: formData.get("status"),
    currency: formData.get("currency") ?? "USD",
    thumbnail: formData.get("thumbnail") ?? "",
  });
}

async function uniqueCourseSlug(base: string, ignoreId?: string) {
  const root = slugify(base);
  let slug = root;
  let suffix = 2;
  while (true) {
    const existing = await db.course.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${root}-${suffix++}`;
  }
}

async function uniqueLessonSlug(courseId: string, base: string, ignoreId?: string) {
  const root = slugify(base);
  let slug = root;
  let suffix = 2;
  while (true) {
    const existing = await db.lesson.findUnique({
      where: { courseId_slug: { courseId, slug } },
      select: { id: true },
    });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${root}-${suffix++}`;
  }
}

async function refreshDuration(courseId: string) {
  const lessons = await db.lesson.findMany({
    where: { courseId, archivedAt: null, module: { archivedAt: null } },
    select: { durationSeconds: true },
  });
  const durationSeconds = lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0);
  await db.course.update({ where: { id: courseId }, data: { durationSeconds } });
}

async function resequence(ids: string[], model: "lesson" | "module") {
  await db.$transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      if (model === "lesson") {
        await tx.lesson.update({ where: { id }, data: { position: -(index + 1) } });
      } else {
        await tx.module.update({ where: { id }, data: { position: -(index + 1) } });
      }
    }
    for (const [index, id] of ids.entries()) {
      if (model === "lesson") {
        await tx.lesson.update({ where: { id }, data: { position: index + 1 } });
      } else {
        await tx.module.update({ where: { id }, data: { position: index + 1 } });
      }
    }
  });
}

function refreshCourse(courseId: string, slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath("/");
  if (slug) revalidatePath(`/courses/${slug}`);
}

export async function createCourse(_prev: string | null, formData: FormData) {
  await requireAdmin();
  const parsed = readCourseForm(formData);
  if (!parsed.success) return "Check the course fields and try again.";
  const data = courseData(parsed.data);
  if (!data) return "Enter a valid price.";
  if (data.originalPriceCents !== null && data.originalPriceCents <= data.priceCents) {
    return "Compare-at price should be higher than the selling price.";
  }
  const slug = await uniqueCourseSlug(parsed.data.slug || parsed.data.title);
  const course = await db.course.create({ data: { ...data, slug } });
  refreshCourse(course.id, slug);
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(courseId: string, _prev: string | null, formData: FormData) {
  await requireAdmin();
  const parsed = readCourseForm(formData);
  if (!parsed.success) return "Check the course fields and try again.";
  const data = courseData(parsed.data);
  if (!data) return "Enter a valid price.";
  if (data.originalPriceCents !== null && data.originalPriceCents <= data.priceCents) {
    return "Compare-at price should be higher than the selling price.";
  }
  const current = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!current) return "Course not found.";
  const slug = await uniqueCourseSlug(parsed.data.slug || parsed.data.title, courseId);
  await db.course.update({ where: { id: courseId }, data: { ...data, slug } });
  refreshCourse(courseId, slug);
  return null;
}

export async function setCourseStatus(courseId: string, status: CourseStatus) {
  await requireAdmin();
  const parsed = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).safeParse(status);
  if (!parsed.success) return;
  if (parsed.data === "PUBLISHED") {
    const ready = await coursePublishState(courseId);
    if (!ready || ready.issues.length > 0) return;
  }
  const course = await db.course.update({
    where: { id: courseId },
    data: { status: parsed.data },
    select: { slug: true },
  });
  refreshCourse(courseId, course.slug);
}

async function coursePublishState(courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      description: true,
      slug: true,
      modules: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          archivedAt: true,
          lessons: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: { id: true, title: true, description: true, videoRef: true, archivedAt: true },
          },
        },
      },
    },
  });
  if (!course) return null;
  return { slug: course.slug, issues: publishIssues({ ...course, courseId }) };
}

export async function publishCourse(courseId: string) {
  await requireAdmin();
  const ready = await coursePublishState(courseId);
  if (!ready) return { ok: false as const, issues: [{ message: "Course not found." }] };
  if (ready.issues.length > 0) return { ok: false as const, issues: ready.issues };
  await db.course.update({ where: { id: courseId }, data: { status: "PUBLISHED" } });
  refreshCourse(courseId, ready.slug);
  return { ok: true as const, slug: ready.slug };
}

export async function duplicateCourse(courseId: string) {
  await requireAdmin();
  const source = await db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            include: { resources: { orderBy: { position: "asc" } } },
          },
        },
      },
    },
  });
  if (!source) return;
  const slug = await uniqueCourseSlug(`${source.title} copy`);
  const created = await db.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        title: `${source.title} copy`,
        slug,
        description: source.description,
        level: source.level,
        status: "DRAFT",
        featured: false,
        priceCents: source.priceCents,
        originalPriceCents: source.originalPriceCents,
        currency: source.currency,
        thumbnail: source.thumbnail,
        technologies: source.technologies,
        outcomes: source.outcomes,
        requirements: source.requirements,
        durationSeconds: source.durationSeconds,
      },
    });
    for (const sourceModule of source.modules) {
      const createdModule = await tx.module.create({
        data: {
          courseId: course.id,
          title: sourceModule.title,
          description: sourceModule.description,
          position: sourceModule.position,
        },
      });
      for (const lesson of sourceModule.lessons) {
        await tx.lesson.create({
          data: {
            courseId: course.id,
            moduleId: createdModule.id,
            title: lesson.title,
            slug: lesson.slug,
            description: lesson.description,
            videoProvider: lesson.videoProvider,
            videoRef: lesson.videoRef,
            durationSeconds: lesson.durationSeconds,
            position: lesson.position,
            isPreview: lesson.isPreview,
            resources: {
              create: lesson.resources.map((resource) => ({
                title: resource.title,
                url: resource.url,
                kind: resource.kind,
                position: resource.position,
              })),
            },
          },
        });
      }
    }
    return course;
  });
  refreshCourse(created.id, created.slug);
  redirect(`/admin/courses/${created.id}`);
}

export async function deleteCourse(courseId: string) {
  await requireAdmin();
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { slug: true, _count: { select: { enrollments: true, orderItems: true } } },
  });
  if (!course) redirect("/admin/courses");
  if (course._count.enrollments > 0 || course._count.orderItems > 0) {
    await db.course.update({ where: { id: courseId }, data: { status: "ARCHIVED" } });
    refreshCourse(courseId, course.slug);
    return;
  }
  await db.course.delete({ where: { id: courseId } });
  refreshCourse(courseId, course.slug);
  redirect("/admin/courses");
}

export async function createModule(courseId: string, _prev: string | null, formData: FormData) {
  await requireAdmin();
  const title = moduleTitleSchema.safeParse(formData.get("title"));
  if (!title.success) return "Module title needs at least 2 characters.";
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, slug: true } });
  if (!course) return "Course not found.";
  const last = await db.module.findFirst({
    where: { courseId, archivedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await db.module.create({
    data: { courseId, title: title.data, position: (last?.position ?? 0) + 1 },
  });
  refreshCourse(courseId, course.slug);
  return null;
}

export async function reorderModules(courseId: string, orderedIds: string[]) {
  await requireAdmin();
  const modules = await db.module.findMany({
    where: { courseId, archivedAt: null },
    select: { id: true },
  });
  const current = new Set(modules.map((module) => module.id));
  if (orderedIds.length !== current.size || orderedIds.some((id) => !current.has(id))) {
    return { ok: false as const };
  }
  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
  await resequence(orderedIds, "module");
  if (course) refreshCourse(courseId, course.slug);
  return { ok: true as const };
}

export async function moveModule(courseId: string, moduleId: string, direction: -1 | 1) {
  await requireAdmin();
  if (direction !== -1 && direction !== 1) return;
  const modules = await db.module.findMany({
    where: { courseId, archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const ids = modules.map((module) => module.id);
  const index = ids.indexOf(moduleId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  const next = [...ids];
  const [row] = next.splice(index, 1);
  if (!row) return;
  next.splice(target, 0, row);
  await resequence(next, "module");
  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
  if (course) refreshCourse(courseId, course.slug);
}

export async function deleteModule(moduleId: string) {
  await requireAdmin();
  const courseModule = await db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, course: { select: { slug: true } } },
  });
  if (!courseModule) return;
  const progress = await db.lessonProgress.count({ where: { lesson: { moduleId } } });
  if (progress > 0) {
    const max = await db.module.aggregate({
      where: { courseId: courseModule.courseId },
      _max: { position: true },
    });
    await db.module.update({
      where: { id: moduleId },
      data: { archivedAt: new Date(), position: Math.max(1_000_000, (max._max.position ?? 0) + 1) },
    });
    const visible = await db.module.findMany({
      where: { courseId: courseModule.courseId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (visible.length > 0) await resequence(visible.map((row) => row.id), "module");
    await refreshDuration(courseModule.courseId);
    refreshCourse(courseModule.courseId, courseModule.course.slug);
    return;
  }
  await db.module.delete({ where: { id: moduleId } });
  const rest = await db.module.findMany({
    where: { courseId: courseModule.courseId, archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (rest.length > 0) await resequence(rest.map((row) => row.id), "module");
  await refreshDuration(courseModule.courseId);
  refreshCourse(courseModule.courseId, courseModule.course.slug);
}

export async function restoreModule(moduleId: string) {
  await requireAdmin();
  const courseModule = await db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, course: { select: { slug: true } } },
  });
  if (!courseModule) return;
  const last = await db.module.findFirst({
    where: { courseId: courseModule.courseId, archivedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await db.module.update({
    where: { id: moduleId },
    data: { archivedAt: null, position: (last?.position ?? 0) + 1 },
  });
  await refreshDuration(courseModule.courseId);
  refreshCourse(courseModule.courseId, courseModule.course.slug);
}

export async function createLesson(moduleId: string, _prev: string | null, formData: FormData) {
  await requireAdmin();
  const title = moduleTitleSchema.safeParse(formData.get("title"));
  if (!title.success) return "Lesson title needs at least 2 characters.";
  const courseModule = await db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, course: { select: { slug: true } } },
  });
  if (!courseModule) return "Module not found.";
  const last = await db.lesson.findFirst({
    where: { moduleId, archivedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const slug = await uniqueLessonSlug(courseModule.courseId, title.data);
  const lesson = await db.lesson.create({
    data: {
      courseId: courseModule.courseId,
      moduleId,
      title: title.data,
      slug,
      description: "",
      position: (last?.position ?? 0) + 1,
    },
  });
  refreshCourse(courseModule.courseId, courseModule.course.slug);
  const focus = formData.get("content") === "video" ? "?focus=video" : "";
  redirect(`/admin/courses/${courseModule.courseId}/lessons/${lesson.id}${focus}`);
}

export async function reorderLessons(moduleId: string, orderedIds: string[]) {
  await requireAdmin();
  const lessons = await db.lesson.findMany({
    where: { moduleId, archivedAt: null },
    select: { id: true, courseId: true, course: { select: { slug: true } } },
  });
  const current = new Set(lessons.map((lesson) => lesson.id));
  if (orderedIds.length !== current.size || orderedIds.some((id) => !current.has(id))) {
    return { ok: false as const };
  }
  await resequence(orderedIds, "lesson");
  const course = lessons[0];
  if (course) refreshCourse(course.courseId, course.course.slug);
  return { ok: true as const };
}

export async function duplicateLesson(lessonId: string) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { resources: true, course: { select: { slug: true } } },
  });
  if (!lesson) return;
  const last = await db.lesson.findFirst({
    where: { moduleId: lesson.moduleId, archivedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const title = `${lesson.title} copy`;
  const slug = await uniqueLessonSlug(lesson.courseId, title);
  await db.lesson.create({
    data: {
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      title,
      slug,
      description: lesson.description,
      videoProvider: lesson.videoProvider,
      videoRef: lesson.videoRef,
      durationSeconds: lesson.durationSeconds,
      position: (last?.position ?? 0) + 1,
      isPreview: false,
      resources: {
        create: lesson.resources.map((resource) => ({
          title: resource.title,
          url: resource.url,
          kind: resource.kind,
          position: resource.position,
        })),
      },
    },
  });
  await refreshDuration(lesson.courseId);
  refreshCourse(lesson.courseId, lesson.course.slug);
}

async function nextVisiblePosition(moduleId: string) {
  const last = await db.lesson.aggregate({
    where: { moduleId, archivedAt: null },
    _max: { position: true },
  });
  return (last._max.position ?? 0) + 1;
}

async function parkLesson(moduleId: string) {
  const max = await db.lesson.aggregate({ where: { moduleId }, _max: { position: true } });
  return Math.max(1_000_000, (max._max.position ?? 0) + 1);
}

async function visibleLessonIds(moduleId: string) {
  const lessons = await db.lesson.findMany({
    where: { moduleId, archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  return lessons.map((lesson) => lesson.id);
}

export async function archiveLesson(lessonId: string) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, moduleId: true, courseId: true, archivedAt: true, course: { select: { slug: true } } },
  });
  if (!lesson || lesson.archivedAt) return;
  await db.lesson.update({
    where: { id: lesson.id },
    data: { archivedAt: new Date(), position: await parkLesson(lesson.moduleId) },
  });
  const remaining = await visibleLessonIds(lesson.moduleId);
  if (remaining.length > 0) await resequence(remaining, "lesson");
  await refreshDuration(lesson.courseId);
  refreshCourse(lesson.courseId, lesson.course.slug);
}

export async function restoreLesson(lessonId: string) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, moduleId: true, courseId: true, course: { select: { slug: true } } },
  });
  if (!lesson) return;
  await db.lesson.update({
    where: { id: lesson.id },
    data: { archivedAt: null, position: await nextVisiblePosition(lesson.moduleId) },
  });
  await refreshDuration(lesson.courseId);
  refreshCourse(lesson.courseId, lesson.course.slug);
}

export async function deleteLesson(lessonId: string) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      courseId: true,
      moduleId: true,
      course: { select: { slug: true } },
      _count: { select: { progress: true } },
    },
  });
  if (!lesson) return;
  if (lesson._count.progress > 0) {
    await archiveLesson(lessonId);
    return;
  }
  await db.lesson.delete({ where: { id: lessonId } });
  const remaining = await visibleLessonIds(lesson.moduleId);
  if (remaining.length > 0) await resequence(remaining, "lesson");
  await refreshDuration(lesson.courseId);
  refreshCourse(lesson.courseId, lesson.course.slug);
}

export async function moveLesson(lessonId: string, targetModuleId: string, placeBeforeId?: string | null) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, moduleId: true, courseId: true, archivedAt: true, course: { select: { slug: true } } },
  });
  const target = await db.module.findUnique({
    where: { id: targetModuleId },
    select: { id: true, courseId: true },
  });
  if (!lesson || !target || lesson.archivedAt || target.courseId !== lesson.courseId) {
    return { ok: false as const };
  }
  if (lesson.moduleId === target.id) return { ok: true as const };
  const sourceId = lesson.moduleId;
  await db.$transaction(async (tx) => {
    const max = await tx.lesson.aggregate({ where: { moduleId: target.id }, _max: { position: true } });
    await tx.lesson.update({
      where: { id: lesson.id },
      data: { moduleId: target.id, position: Math.max(1_000_000, (max._max.position ?? 0) + 1) },
    });
    for (const moduleId of [sourceId, target.id]) {
      const rows = await tx.lesson.findMany({
        where: { moduleId, archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const ordered =
        moduleId === target.id
          ? insertBefore(
              rows.map((row) => row.id),
              lesson.id,
              placeBeforeId ?? null,
            )
          : rows.map((row) => row.id);
      for (const [index, id] of ordered.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of ordered.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: index + 1 } });
      }
    }
  });
  await refreshDuration(lesson.courseId);
  refreshCourse(lesson.courseId, lesson.course.slug);
  return { ok: true as const };
}

export async function updateLesson(_prev: string | null, formData: FormData) {
  await requireAdmin();
  const lessonId = String(formData.get("lessonId") ?? "");
  const parsed = lessonInputSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    minutes: formData.get("minutes") ?? 0,
    seconds: formData.get("seconds") ?? 0,
    videoUrl: formData.get("videoUrl") ?? "",
    isPreview: formData.get("isPreview") === "on",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "title") return "Lesson title needs at least 2 characters.";
    return "Check the lesson fields and try again.";
  }

  const courseId = String(formData.get("courseId") ?? "");
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true, updatedAt: true, course: { select: { slug: true, status: true } } },
  });
  if (!lesson || lesson.courseId !== courseId) return "That lesson is not part of this course.";
  const expected = String(formData.get("updatedAt") ?? "");
  if (expected && lesson.updatedAt.toISOString() !== expected) {
    return "This lesson was saved somewhere else. Reload and try again.";
  }

  let videoProvider = undefined as "YOUTUBE" | "VIMEO" | "EXTERNAL" | undefined;
  let videoRef: string | null | undefined;
  if (!parsed.data.videoUrl) {
    videoRef = null;
  } else {
    const detected = detectVideo(parsed.data.videoUrl);
    if (!detected) return "Enter a valid YouTube or Vimeo URL.";
    videoProvider = detected.provider;
    videoRef = detected.ref;
  }

  const autosave = formData.get("saveMode") === "auto";
  const slug = autosave
    ? undefined
    : await uniqueLessonSlug(lesson.courseId, parsed.data.slug || parsed.data.title, lesson.id);
  const saved = await db.lesson.updateMany({
    where: { id: lesson.id, updatedAt: lesson.updatedAt },
    data: autosave
      ? {
          title: parsed.data.title,
          description: parsed.data.description,
          ...(videoProvider ? { videoProvider } : {}),
          ...(videoRef !== undefined ? { videoRef } : {}),
        }
      : {
          title: parsed.data.title,
          slug,
          description: parsed.data.description,
          durationSeconds: parsed.data.minutes * 60 + parsed.data.seconds,
          isPreview: parsed.data.isPreview,
          ...(videoProvider ? { videoProvider } : {}),
          ...(videoRef !== undefined ? { videoRef } : {}),
        },
  });
  if (saved.count === 0) return "This lesson was saved somewhere else. Reload and try again.";
  const fresh = await db.lesson.findUnique({ where: { id: lesson.id }, select: { updatedAt: true, slug: true } });
  await refreshDuration(lesson.courseId);
  refreshCourse(lesson.courseId, lesson.course.slug);
  if (!autosave) revalidatePath(`/admin/courses/${lesson.courseId}/lessons/${lesson.id}`);
  if (fresh) revalidatePath(`/learn/${lesson.course.slug}/${fresh.slug}`);
  return fresh ? `saved:${fresh.updatedAt.toISOString()}` : null;
}

export async function addLessonResource(_prev: string | null, formData: FormData) {
  await requireAdmin();
  const lessonId = String(formData.get("lessonId") ?? "");
  const parsed = resourceSchema.safeParse({
    title: formData.get("title"),
    url: formData.get("url"),
    kind: formData.get("kind") ?? "LINK",
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid resource.";
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true, course: { select: { slug: true } } },
  });
  if (!lesson || lesson.courseId !== String(formData.get("courseId") ?? "")) {
    return "That lesson is not part of this course.";
  }
  const last = await db.lessonResource.findFirst({
    where: { lessonId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await db.lessonResource.create({
    data: {
      lessonId,
      title: parsed.data.title,
      url: parsed.data.url,
      kind: parsed.data.kind,
      position: (last?.position ?? 0) + 1,
    },
  });
  refreshCourse(lesson.courseId, lesson.course.slug);
  return null;
}

export async function reorderLessonResources(lessonId: string, orderedIds: string[]) {
  await requireAdmin();
  const resources = await db.lessonResource.findMany({
    where: { lessonId },
    select: { id: true, lesson: { select: { courseId: true, course: { select: { slug: true } } } } },
  });
  const current = new Set(resources.map((resource) => resource.id));
  if (orderedIds.length !== current.size || orderedIds.some((id) => !current.has(id))) {
    return { ok: false as const };
  }
  await db.$transaction(
    orderedIds.map((id, index) => db.lessonResource.update({ where: { id }, data: { position: index + 1 } })),
  );
  const lesson = resources[0]?.lesson;
  if (lesson) refreshCourse(lesson.courseId, lesson.course.slug);
  return { ok: true as const };
}

export async function deleteLessonResource(resourceId: string, lessonId: string) {
  await requireAdmin();
  const resource = await db.lessonResource.findUnique({
    where: { id: resourceId },
    select: { lessonId: true, lesson: { select: { courseId: true, course: { select: { slug: true } } } } },
  });
  if (!resource || resource.lessonId !== lessonId) return;
  await db.lessonResource.delete({ where: { id: resourceId } });
  refreshCourse(resource.lesson.courseId, resource.lesson.course.slug);
}

export async function createProject(courseId: string, _prev: string | null, formData: FormData) {
  await requireAdmin();
  const title = moduleTitleSchema.safeParse(formData.get("title"));
  const description = z.string().trim().min(10).max(2000).safeParse(formData.get("description"));
  if (!title.success || !description.success) return "Add a title and a short description.";
  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
  if (!course) return "Course not found.";
  const last = await db.courseProject.findFirst({
    where: { courseId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await db.courseProject.create({
    data: {
      courseId,
      title: title.data,
      description: description.data,
      position: (last?.position ?? 0) + 1,
    },
  });
  refreshCourse(courseId, course.slug);
  return null;
}

export async function deleteProject(projectId: string) {
  await requireAdmin();
  const project = await db.courseProject.findUnique({
    where: { id: projectId },
    select: { courseId: true, course: { select: { slug: true } } },
  });
  if (!project) return;
  await db.courseProject.delete({ where: { id: projectId } });
  refreshCourse(project.courseId, project.course.slug);
}

export async function enrollStudent(_prev: string | null, formData: FormData) {
  await requireAdmin();
  const parsed = enrollSchema.safeParse({
    email: formData.get("email"),
    courseId: formData.get("courseId"),
  });
  if (!parsed.success) return "Enter a valid email and course.";
  const user = await db.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return "No account uses that email yet.";
  const course = await db.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true } });
  if (!course) return "This course isn't available right now.";
  try {
    const result = await grantEnrollment({ userId: user.id, courseId: course.id, source: "MANUAL" });
    if (result.outcome === "already_enrolled") return "Student is already enrolled in this course.";
  } catch (error) {
    logServerError("enrollStudent", error);
    return "We couldn't enroll the student. Please try again.";
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  return null;
}

export async function enrollStudentById(userId: string, _previous: string | null, formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      userId: z.string().trim().min(1).max(64),
      courseId: z.string().trim().min(1).max(64),
    })
    .safeParse({ userId, courseId: formData.get("courseId") });
  if (!parsed.success) return "Choose a course.";
  const user = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  const course = await db.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true } });
  if (!user || !course) return "This course isn't available right now.";
  try {
    const result = await grantEnrollment({ userId: user.id, courseId: course.id, source: "MANUAL" });
    if (result.outcome === "already_enrolled") return "Student is already enrolled in this course.";
  } catch (error) {
    logServerError("enrollStudentById", error);
    return "We couldn't enroll the student. Please try again.";
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  return null;
}

export async function cancelEnrollment(enrollmentId: string) {
  await requireAdmin();
  const parsed = z.string().trim().min(1).max(64).safeParse(enrollmentId);
  if (!parsed.success) return;
  const enrollment = await db.enrollment.findUnique({
    where: { id: parsed.data },
    select: { id: true, userId: true },
  });
  if (!enrollment) return;
  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${enrollment.userId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
}
