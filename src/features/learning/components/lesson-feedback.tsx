"use client";

import { useId, useRef } from "react";
import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fieldControl } from "@/features/admin/components/course-fields";
import { submitFeedback } from "@/features/feedback/actions";
import { cn } from "cn";

const types = [
  { id: "CONTENT", label: "Content" },
  { id: "TECHNICAL_ISSUE", label: "Technical issue" },
  { id: "SUGGESTION", label: "Suggestion" },
  { id: "OTHER", label: "Other" },
] as const;

export function LessonFeedback({
  courseId,
  lessonId,
  route,
  label = "Send feedback",
}: {
  courseId: string;
  lessonId: string;
  route: string;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(async (previous: string | null, formData: FormData) => {
    const result = await submitFeedback(previous, formData);
    if (result === "sent") dialogRef.current?.close();
    return result;
  }, null);
  const thanks = state === "sent";

  return (
    <div>
      <button
        type="button"
        className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground"
        onClick={() => dialogRef.current?.showModal()}
      >
        {label}
      </button>
      {thanks ? (
        <p role="status" className="text-sm text-primary">
          Thanks — your feedback was sent.
        </p>
      ) : null}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(calc(100%-2rem),28rem)] rounded-2xl border border-border bg-card p-6 text-foreground backdrop:bg-black/70"
      >
        <h2 id={titleId} className="text-lg font-medium tracking-tight">
          What would you like to tell us?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">A private note about this lesson. It is not a public review.</p>
        <form action={formAction} className="mt-4 grid gap-3">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="stay" value="1" />
          <input type="hidden" name="route" value={route} />
          <fieldset className="grid gap-1">
            <legend className="sr-only">Feedback type</legend>
            {types.map((type) => (
              <label key={type.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="type" value={type.id} required className="size-4" defaultChecked={type.id === "CONTENT"} />
                {type.label}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="lesson-feedback">Message</Label>
            <textarea id="lesson-feedback" name="message" required minLength={10} maxLength={2000} rows={4} className={fieldControl} />
          </div>
          {state && state !== "sent" ? (
            <p role="alert" className="text-sm text-destructive">
              {state}
            </p>
          ) : null}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")} onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={cn(buttonVariants(), "h-11 px-4")}>
              {pending ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
