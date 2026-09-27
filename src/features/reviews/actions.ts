"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { canWriteReview, plainReviewText, validRating } from "@/features/reviews/eligibility";
import { requireAdmin, requireUser } from "@/server/authz";

const reviewSchema = z.object({
  courseId: z.string().trim().min(1).max(64),
  rating: z.coerce.number(),
  title: z.string().trim().max(100).optional().or(z.literal("")),
  comment: z.string().trim().max(2000),
});

async function courseForReview(courseId: string) {
  return db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, status: true },
  });
}

async function eligible(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });
  const [lessonCount, completedLessons] = await Promise.all([
    db.lesson.count({
      where: { courseId, archivedAt: null, module: { archivedAt: null } },
    }),
    db.lessonProgress.count({
      where: {
        userId,
        completed: true,
        lesson: { courseId, archivedAt: null, module: { archivedAt: null } },
      },
    }),
  ]);
  return canWriteReview({
    enrollmentStatus: enrollment?.status ?? null,
    completedLessons,
    lessonCount,
  });
}

export async function saveReview(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse({
    courseId: formData.get("courseId"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success || !validRating(parsed.data.rating)) return "Choose a rating from 1 to 5.";
  const course = await courseForReview(parsed.data.courseId);
  if (!course || course.status === "ARCHIVED") return "This course isn't available.";
  if (!(await eligible(user.id, course.id))) return "Finish more of the course before leaving a review.";

  const title = plainReviewText(parsed.data.title ?? "").slice(0, 100);
  const comment = plainReviewText(parsed.data.comment).slice(0, 2000);
  const existing = await db.courseReview.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });
  if (existing) {
    await db.courseReview.update({
      where: { id: existing.id },
      data: {
        rating: parsed.data.rating,
        title: title || null,
        comment,
        removedAt: null,
      },
    });
  } else {
    await db.courseReview.create({
      data: {
        userId: user.id,
        courseId: course.id,
        rating: parsed.data.rating,
        title: title || null,
        comment,
        status: "PUBLISHED",
      },
    });
  }
  revalidatePath(`/courses/${course.slug}`);
  return null;
}

export async function removeOwnReview(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const courseId = z.string().trim().min(1).max(64).safeParse(formData.get("courseId"));
  if (!courseId.success) return "Choose a review.";
  const course = await courseForReview(courseId.data);
  const updated = await db.courseReview.updateMany({
    where: { userId: user.id, courseId: courseId.data, removedAt: null },
    data: { removedAt: new Date() },
  });
  if (updated.count === 0) return "That review isn't available.";
  if (course) revalidatePath(`/courses/${course.slug}`);
  return null;
}

export async function moderateReview(_previous: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();
  const reviewId = z.string().trim().min(1).max(64).safeParse(formData.get("reviewId"));
  const status = z.enum(["PUBLISHED", "HIDDEN", "FLAGGED"]).safeParse(formData.get("status"));
  if (!reviewId.success || !status.success) return "Choose a review.";
  const review = await db.courseReview.findUnique({
    where: { id: reviewId.data },
    select: { id: true, removedAt: true, course: { select: { slug: true } } },
  });
  if (!review) return "That review isn't available.";
  if (review.removedAt && status.data === "PUBLISHED") return "The student removed this review.";
  await db.courseReview.update({
    where: { id: review.id },
    data: { status: status.data },
  });
  revalidatePath(`/courses/${review.course.slug}`);
  revalidatePath("/admin/reviews");
  return null;
}
