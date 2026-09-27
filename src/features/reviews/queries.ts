import { db } from "@/lib/db";
import { canWriteReview, ratingSummary } from "@/features/reviews/eligibility";

const pageSize = 10;

export async function getReviewSummary(courseId: string) {
  const grouped = await db.courseReview.groupBy({
    by: ["rating"],
    where: { courseId, status: "PUBLISHED", removedAt: null },
    _count: { _all: true },
  });
  const counts: Partial<Record<1 | 2 | 3 | 4 | 5, number>> = {};
  for (const row of grouped) {
    if (row.rating >= 1 && row.rating <= 5) counts[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
  }
  return ratingSummary(counts);
}

export async function getPublicReviews(courseId: string, sort: string, page: number) {
  const where = { courseId, status: "PUBLISHED" as const, removedAt: null };
  const orderBy =
    sort === "highest"
      ? [{ rating: "desc" as const }, { createdAt: "desc" as const }]
      : sort === "lowest"
        ? [{ rating: "asc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];
  const [reviews, summary] = await Promise.all([
    db.courseReview.findMany({
      where,
      orderBy,
      skip: page * pageSize,
      take: pageSize,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    getReviewSummary(courseId),
  ]);
  return { reviews, summary, pageSize };
}

export async function getOwnReview(userId: string, courseId: string) {
  return db.courseReview.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { rating: true, title: true, comment: true, status: true, removedAt: true },
  });
}

export async function getReviewEligibility(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });
  const [lessonCount, completedLessons] = await Promise.all([
    db.lesson.count({ where: { courseId, archivedAt: null, module: { archivedAt: null } } }),
    db.lessonProgress.count({
      where: { userId, completed: true, lesson: { courseId, archivedAt: null, module: { archivedAt: null } } },
    }),
  ]);
  return canWriteReview({
    enrollmentStatus: enrollment?.status ?? null,
    completedLessons,
    lessonCount,
  });
}

export async function getAdminReviews(status: string) {
  const filter = status === "hidden" ? "HIDDEN" : status === "flagged" ? "FLAGGED" : status === "published" ? "PUBLISHED" : undefined;
  return db.courseReview.findMany({
    where: filter ? { status: filter } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      status: true,
      removedAt: true,
      createdAt: true,
      user: { select: { name: true } },
      course: { select: { title: true, slug: true } },
    },
  });
}
