"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { markLessonCompleted, markLessonIncomplete } from "@/features/learning/actions";
import { useLearningProgress } from "@/features/learning/components/learn-shell";
import { splitCourseTitle } from "@/features/courses/format";
import { cn } from "cn";

type LessonRef = {
  slug: string;
  title: string;
  moduleTitle: string;
  modulePosition: number;
};

export function LessonControls({
  lessonId,
  lessonSlug,
  completed,
  canComplete,
  previous,
  next,
  courseSlug,
  modulePosition,
  courseTitle,
  courseAlreadyComplete,
  children,
}: {
  lessonId: string;
  lessonSlug: string;
  completed: boolean;
  canComplete: boolean;
  previous: LessonRef | null;
  next: LessonRef | null;
  courseSlug: string;
  modulePosition: number;
  courseTitle: string;
  courseAlreadyComplete: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const progress = useLearningProgress();
  const [done, setDone] = useState(completed);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextLesson, setNextLesson] = useState<LessonRef | null>(completed ? next : null);
  const [courseComplete, setCourseComplete] = useState(courseAlreadyComplete);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = splitCourseTitle(courseTitle);
  const destination = nextLesson ?? next;

  function complete() {
    const previousDone = done;
    setDone(true);
    setError(null);
    progress?.mark(lessonSlug, true);
    startTransition(async () => {
      const result = await markLessonCompleted(lessonId);
      if (!result.ok) {
        setDone(previousDone);
        progress?.mark(lessonSlug, previousDone);
        setError(result.error ?? "We couldn't save that. Please try again.");
        return;
      }
      setCourseComplete(result.courseCompleted);
      setNextLesson(result.next);
      if (result.courseCompleted) {
        setNotice(null);
      } else if (result.moduleCompleted && result.next && result.next.modulePosition !== modulePosition) {
        setNotice(`Module ${modulePosition} complete. Next is Module ${result.next.modulePosition} — ${result.next.moduleTitle}.`);
      } else if (result.moduleCompleted) {
        setNotice(`Module ${modulePosition} complete.`);
      } else {
        setNotice(null);
      }
      router.refresh();
    });
  }

  function undo() {
    setError(null);
    startTransition(async () => {
      const result = await markLessonIncomplete(lessonId);
      if (!result.ok) {
        setError(result.error ?? "We couldn't save that. Please try again.");
        return;
      }
      setDone(false);
      setNotice(null);
      setCourseComplete(false);
      progress?.mark(lessonSlug, false);
      router.refresh();
    });
  }

  if (courseComplete) {
    return (
      <section className="mt-10" aria-labelledby="course-complete-heading">
        <p className="text-sm text-primary">Course complete</p>
        <h2 id="course-complete-heading" className="mt-2 text-2xl font-medium tracking-tight">
          {title.name}
        </h2>
        {title.subtitle ? <p className="mt-1 text-muted-foreground">{title.subtitle}</p> : null}
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          You&apos;ve completed all lessons in this course.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/dashboard" className={cn(buttonVariants(), "h-11 px-4")}>
            Back to dashboard
          </Link>
          <Link href={`/courses/${courseSlug}#reviews`} className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
            Review course
          </Link>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </section>
    );
  }

  return (
    <div className="mt-10">
      {done ? (
        <p role="status" className="text-sm text-primary">
          ✓ Lesson completed
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col items-start gap-3">
        {done && destination ? (
          <div className="w-full">
            <p className="text-sm text-muted-foreground">
              {destination.modulePosition !== modulePosition ? "Next module" : "Next"}
            </p>
            <p className="mt-1 text-base font-medium break-words">{destination.title}</p>
            <Link
              href={`/learn/${courseSlug}/${destination.slug}`}
              className={cn(buttonVariants(), "mt-3 h-11 w-full px-4 sm:w-fit")}
            >
              Continue to next lesson
            </Link>
          </div>
        ) : null}

        {canComplete && done ? (
          <button type="button" className="inline-flex h-11 items-center text-sm text-muted-foreground" onClick={undo} disabled={pending}>
            {pending ? "Saving…" : "Mark as incomplete"}
          </button>
        ) : canComplete ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
            onClick={complete}
            disabled={pending}
          >
            {pending ? "Saving…" : "Mark as completed"}
          </button>
        ) : (
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
            Sign in to save progress
          </Link>
        )}

        {!done && destination ? (
          <Link
            href={`/learn/${courseSlug}/${destination.slug}`}
            className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground"
          >
            Next lesson
          </Link>
        ) : null}
        {previous ? (
          <Link
            href={`/learn/${courseSlug}/${previous.slug}`}
            className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground"
          >
            Previous lesson
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}
