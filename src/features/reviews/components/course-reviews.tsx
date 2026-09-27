import Link from "next/link";
import { ReviewForm, RemoveReviewButton } from "@/features/reviews/components/review-form";
import { publicReviewName } from "@/features/reviews/eligibility";
import { getOwnReview, getPublicReviews, getReviewEligibility } from "@/features/reviews/queries";
import { formatRelative } from "@/lib/time";

function Stars({ rating }: { rating: number }) {
  const icons = "★★★★★☆☆☆☆☆".slice(5 - rating, 10 - rating);
  return (
    <p className="text-sm">
      <span className="sr-only">{rating} out of 5 stars</span>
      <span aria-hidden>{icons}</span>
    </p>
  );
}

export async function CourseReviews({
  courseId,
  courseSlug,
  courseTitle,
  userId,
  sort,
  page,
}: {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  userId: string | null;
  sort: string;
  page: number;
}) {
  const [{ reviews, summary, pageSize }, own, eligible] = await Promise.all([
    getPublicReviews(courseId, sort, page),
    userId ? getOwnReview(userId, courseId) : Promise.resolve(null),
    userId ? getReviewEligibility(userId, courseId) : Promise.resolve(false),
  ]);
  const pages = Math.max(1, Math.ceil(summary.count / pageSize));
  const href = (nextSort: string, nextPage: number) => {
    const params = new URLSearchParams();
    if (nextSort !== "newest") params.set("reviewSort", nextSort);
    if (nextPage > 0) params.set("reviewPage", String(nextPage));
    const query = params.toString();
    return query ? `/courses/${courseSlug}?${query}#reviews` : `/courses/${courseSlug}#reviews`;
  };
  const visibleOwn = own && !own.removedAt ? own : null;

  return (
    <section id="reviews" className="mt-14">
      <h2 className="text-xl font-medium">Student reviews</h2>
      {summary.count === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No reviews yet. Enrolled students can share their experience after starting the course.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <div>
            <p className="text-3xl font-medium tracking-tight">{summary.average}</p>
            <p className="sr-only">{summary.average} out of 5 stars</p>
            <Stars rating={Math.round(summary.average ?? 0)} />
            <p className="mt-1 text-sm text-muted-foreground">Based on {summary.count} reviews</p>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.distribution.map((row) => (
              <li key={row.star} className="flex items-center gap-3">
                <span className="w-10">{row.star} star</span>
                <span className="text-muted-foreground">{row.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eligible && !visibleOwn ? (
        <div className="mt-6 rounded-2xl border border-border p-5">
          <p className="text-sm text-muted-foreground">Enjoying {courseTitle.split(": ")[0]}? Share your experience with other learners.</p>
          <div className="mt-4">
            <ReviewForm courseId={courseId} />
          </div>
        </div>
      ) : null}

      {visibleOwn ? (
        <div className="mt-6 rounded-2xl border border-border p-5">
          <p className="text-sm font-medium">Your review</p>
          {visibleOwn.status !== "PUBLISHED" ? (
            <p className="mt-1 text-sm text-muted-foreground">This review is not public right now.</p>
          ) : null}
          <div className="mt-4">
            <ReviewForm
              courseId={courseId}
              initial={{ rating: visibleOwn.rating, title: visibleOwn.title ?? "", comment: visibleOwn.comment }}
            />
          </div>
          <div className="mt-3">
            <RemoveReviewButton courseId={courseId} />
          </div>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <>
          <div className="mt-6 flex gap-3 text-sm" role="navigation" aria-label="Review sort">
            {[
              ["newest", "Newest"],
              ["highest", "Highest rating"],
              ["lowest", "Lowest rating"],
            ].map(([id, label]) => (
              <Link key={id} href={href(id, 0)} aria-current={sort === id || (id === "newest" && sort !== "highest" && sort !== "lowest") ? "page" : undefined} className="text-muted-foreground underline-offset-4 hover:underline aria-[current=page]:text-foreground">
                {label}
              </Link>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {reviews.map((review) => (
              <li key={review.id} className="py-4">
                <p className="text-sm font-medium">{publicReviewName(review.user.name)}</p>
                <Stars rating={review.rating} />
                <p className="text-xs text-muted-foreground">Verified learner · {formatRelative(review.createdAt)}</p>
                {review.title ? <p className="mt-2 text-sm font-medium">{review.title}</p> : null}
                {review.comment ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <div className="mt-4 flex gap-4 text-sm">
              {page > 0 ? <Link href={href(sort, page - 1)}>Previous</Link> : null}
              {page + 1 < pages ? <Link href={href(sort, page + 1)}>Next</Link> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
