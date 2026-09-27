"use client";

import { useActionState, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { removeOwnReview, saveReview } from "@/features/reviews/actions";
import { cn } from "cn";

export function ReviewForm({
  courseId,
  initial,
}: {
  courseId: string;
  initial?: { rating: number; title: string; comment: string };
}) {
  const [error, action, pending] = useActionState(saveReview, null);
  const [rating, setRating] = useState(initial?.rating ?? 0);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <fieldset>
        <legend className="text-sm font-medium">How would you rate this course?</legend>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={value}
                defaultChecked={initial?.rating === value}
                required
                className="peer sr-only"
                onChange={() => setRating(value)}
              />
              <span className="sr-only">{value} out of 5 stars</span>
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-lg border border-border text-lg peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  value <= rating ? "border-primary text-primary" : "text-muted-foreground",
                )}
              >
                ★
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm">
        Title <span className="text-muted-foreground">(optional)</span>
        <input
          name="title"
          maxLength={100}
          defaultValue={initial?.title ?? ""}
          className="h-11 rounded-lg border border-input bg-background px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Share your experience
        <textarea
          name="comment"
          maxLength={2000}
          rows={4}
          defaultValue={initial?.comment ?? ""}
          className="rounded-lg border border-input bg-background px-3 py-2"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants(), "h-11 w-fit")}>
        {pending ? "Saving…" : initial ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}

export function RemoveReviewButton({ courseId }: { courseId: string }) {
  const [error, action, pending] = useActionState(removeOwnReview, null);
  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {pending ? "Removing…" : "Remove review"}
      </button>
    </form>
  );
}
