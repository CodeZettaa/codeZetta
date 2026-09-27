import type { Metadata } from "next";
import Link from "next/link";
import { BoundForm } from "@/features/admin/components/bound-form";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { moderateReview } from "@/features/reviews/actions";
import { getAdminReviews } from "@/features/reviews/queries";
import { publicReviewName } from "@/features/reviews/eligibility";
import { formatDate } from "@/lib/time";
import { requireAdmin } from "@/server/authz";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reviews" };

const filters = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "hidden", label: "Hidden" },
  { id: "flagged", label: "Flagged" },
];

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "all" } = await searchParams;
  const reviews = await getAdminReviews(status);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/reviews" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">Reviews</h1>
      <p className="mt-2 text-sm text-muted-foreground">Hide or publish a review. The student’s words stay as they wrote them.</p>
      <div className="mt-4 flex gap-2" role="navigation" aria-label="Review status">
        {filters.map((filter) => (
          <Link
            key={filter.id}
            href={filter.id === "all" ? "/admin/reviews" : `/admin/reviews?status=${filter.id}`}
            aria-current={status === filter.id ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm text-muted-foreground", status === filter.id && "bg-muted text-foreground")}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <ul className="mt-6 space-y-4">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-2xl border border-border p-4 text-sm">
            <p>
              {publicReviewName(review.user.name)} · {review.course.title} · {review.rating} out of 5 stars
            </p>
            <p className="mt-1 text-muted-foreground">
              {review.status}
              {review.removedAt ? " · Removed by student" : ""} · {formatDate(review.createdAt)}
            </p>
            {review.title ? <p className="mt-3 font-medium">{review.title}</p> : null}
            {review.comment ? <p className="mt-1 leading-6">{review.comment}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {review.status !== "PUBLISHED" && !review.removedAt ? (
                <BoundForm action={moderateReview} submitLabel="Publish" className="flex items-center gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="status" value="PUBLISHED" />
                </BoundForm>
              ) : null}
              {review.status !== "HIDDEN" ? (
                <BoundForm action={moderateReview} submitLabel="Hide" className="flex items-center gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="status" value="HIDDEN" />
                </BoundForm>
              ) : null}
              {review.status !== "FLAGGED" ? (
                <BoundForm action={moderateReview} submitLabel="Flag" className="flex items-center gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="status" value="FLAGGED" />
                </BoundForm>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
