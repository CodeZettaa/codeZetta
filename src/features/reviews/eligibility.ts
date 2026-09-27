import { completionPercent } from "@/features/learning/progress";

/** Completed lessons must reach this share of the visible curriculum. */
export const REVIEW_MIN_PERCENT = 20;

export function canWriteReview(input: {
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | null;
  completedLessons: number;
  lessonCount: number;
}) {
  if (input.enrollmentStatus !== "ACTIVE" && input.enrollmentStatus !== "COMPLETED") return false;
  if (input.completedLessons < 1 || input.lessonCount < 1) return false;
  return completionPercent(input.completedLessons, input.lessonCount) >= REVIEW_MIN_PERCENT;
}

export function isPublicReview(review: { status: string; removedAt: Date | null }) {
  return review.status === "PUBLISHED" && review.removedAt === null;
}

export function ratingSummary(counts: Partial<Record<1 | 2 | 3 | 4 | 5, number>>) {
  let weighted = 0;
  let total = 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = counts[star as 1 | 2 | 3 | 4 | 5] ?? 0;
    weighted += star * count;
    total += count;
    return { star, count, percent: 0 };
  });
  if (total === 0) return { average: null as number | null, count: 0, distribution };
  return {
    average: Math.round((weighted * 10) / total) / 10,
    count: total,
    distribution: distribution.map((row) => ({ ...row, percent: Math.round((row.count / total) * 100) })),
  };
}

export function publicReviewName(name: string | null | undefined) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || trimmed.includes("@")) return "Learner";
  return trimmed.split(/\s+/)[0] || "Learner";
}

export function plainReviewText(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function validRating(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
