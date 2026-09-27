import { cache } from "react";
import { db } from "@/lib/db";
import { pickContinueLesson } from "@/features/enrollment/continue";
import { completionPercent } from "@/features/learning/progress";
import { requireAdmin } from "@/server/authz";

export async function getAdminOverview() {
  await requireAdmin();
  const [courses, students, enrollments, lessons] = await Promise.all([
    db.course.count(),
    db.user.count({ where: { role: "STUDENT" } }),
    db.enrollment.count({ where: { status: { in: ["ACTIVE", "COMPLETED"] } } }),
    db.lesson.count(),
  ]);
  return { courses, students, enrollments, lessons };
}

export async function getAdminCourses() {
  await requireAdmin();
  return db.course.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      featured: true,
      level: true,
      updatedAt: true,
      _count: { select: { modules: true, lessons: true, enrollments: true } },
    },
  });
}

export async function getAdminCourse(courseId: string) {
  await requireAdmin();
  return db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { _count: { select: { progress: true } } },
          },
        },
      },
      projects: { orderBy: { position: "asc" } },
      _count: {
        select: { enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED"] } } } },
      },
    },
  });
}

export async function getAdminLesson(lessonId: string) {
  await requireAdmin();
  return db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      resources: { orderBy: { position: "asc" } },
      course: { select: { id: true, title: true, slug: true, status: true } },
      module: { select: { id: true, title: true } },
    },
  });
}

export async function getAdminStudents(query = "", filter: "all" | "enrolled" | "none" = "all") {
  await requireAdmin();
  const term = query.trim().slice(0, 80);
  const active = { status: { in: ["ACTIVE" as const, "COMPLETED" as const] } };
  return db.user.findMany({
    where: {
      role: "STUDENT",
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filter === "enrolled" ? { enrollments: { some: active } } : {}),
      ...(filter === "none" ? { enrollments: { none: active } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      enrollments: {
        where: active,
        select: { id: true },
      },
    },
  });
}

export async function getEnrollmentCourseOptions(userId: string) {
  await requireAdmin();
  const [courses, enrollments] = await Promise.all([
    db.course.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, priceCents: true, currency: true, status: true },
    }),
    db.enrollment.findMany({
      where: { userId },
      select: { courseId: true, status: true },
    }),
  ]);
  const byCourse = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment.status]));
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    priceCents: course.priceCents,
    currency: course.currency,
    courseStatus: course.status,
    enrollmentStatus: byCourse.get(course.id) ?? null,
  }));
}

export const getAdminStudent = cache(async (userId: string) => {
  await requireAdmin();
  const student = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          completedAt: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              lessons: {
                where: { archivedAt: null, module: { archivedAt: null } },
                orderBy: [{ module: { position: "asc" } }, { position: "asc" }],
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  position: true,
                  module: { select: { title: true, position: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!student || student.role !== "STUDENT") return null;
  const lessonIds = student.enrollments.flatMap((enrollment) => enrollment.course.lessons.map((lesson) => lesson.id));
  const progressRows = lessonIds.length
    ? await db.lessonProgress.findMany({
        where: { userId: student.id, lessonId: { in: lessonIds } },
        select: { lessonId: true, completed: true, lastWatchedAt: true },
      })
    : [];
  const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    createdAt: student.createdAt,
    enrollments: student.enrollments.map((enrollment) => {
      const lessons = enrollment.course.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        position: lesson.position,
        moduleTitle: lesson.module.title,
        modulePosition: lesson.module.position,
      }));
      const marks = lessons.flatMap((lesson) => {
        const row = progressByLesson.get(lesson.id);
        return row ? [{ lessonId: lesson.id, completed: row.completed, lastWatchedAt: row.lastWatchedAt }] : [];
      });
      const completedLessons = marks.filter((row) => row.completed).length;
      const last = [...marks].sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime())[0];
      const lastLesson = last ? lessons.find((lesson) => lesson.id === last.lessonId) : null;
      const current = pickContinueLesson(lessons, marks);
      return {
        id: enrollment.id,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        lessonCount: lessons.length,
        completedLessons,
        percent: completionPercent(completedLessons, lessons.length),
        lastActivity:
          last && lastLesson
            ? { at: last.lastWatchedAt, lessonTitle: lastLesson.title }
            : null,
        currentLesson: current ? { title: current.title, moduleTitle: current.moduleTitle } : null,
        course: {
          title: enrollment.course.title,
          slug: enrollment.course.slug,
        },
      };
    }),
  };
});

export async function getAdminEnrollments() {
  await requireAdmin();
  const [courses, enrollments] = await Promise.all([
    db.course.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
    db.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 80,
      select: {
        id: true,
        status: true,
        source: true,
        enrolledAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    }),
  ]);
  return { courses, enrollments };
}
