"use client";

import { useId, useRef, useState } from "react";
import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { enrollStudentById } from "@/features/admin/actions";
import { fieldControl } from "@/features/admin/components/course-fields";
import { formatPrice } from "@/features/courses/format";
import { cn } from "cn";

type CourseOption = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  courseStatus: string;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | null;
};

const statusCopy = {
  ACTIVE: "Student is already enrolled in this course.",
  COMPLETED: "Student is already enrolled in this course.",
  CANCELLED: "This enrollment was cancelled. Enrolling again restores access.",
} as const;

export function EnrollStudentDialog({ userId, courses }: { userId: string; courses: CourseOption[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [message, formAction, pending] = useActionState(enrollStudentById.bind(null, userId), null);
  const selected = courses.find((course) => course.id === courseId) ?? null;
  const blocked = selected?.enrollmentStatus === "ACTIVE" || selected?.enrollmentStatus === "COMPLETED";

  return (
    <>
      <button
        type="button"
        className={cn(buttonVariants(), "h-11 px-4")}
        onClick={() => dialogRef.current?.showModal()}
      >
        Enroll student
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(calc(100%-2rem),32rem)] rounded-2xl border border-border bg-card p-6 text-foreground backdrop:bg-black/70"
      >
        <h2 id={titleId} className="text-lg font-medium tracking-tight">
          Enroll student
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose a course. An existing enrollment is kept as one record.
        </p>
        <form action={formAction} className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="enroll-course">Course</Label>
            <select
              id="enroll-course"
              name="courseId"
              required
              className={fieldControl}
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          {selected ? (
            <div className="rounded-xl border border-border px-4 py-3 text-sm">
              <p className="font-medium">{selected.title}</p>
              <p className="mt-1 text-muted-foreground">
                {formatPrice(selected.priceCents, selected.currency)}
                {selected.courseStatus !== "PUBLISHED" ? ` · ${selected.courseStatus.toLowerCase()}` : ""}
              </p>
              {selected.enrollmentStatus ? (
                <p className="mt-2 text-muted-foreground">{statusCopy[selected.enrollmentStatus]}</p>
              ) : (
                <p className="mt-2 text-muted-foreground">Not enrolled yet.</p>
              )}
            </div>
          ) : null}
          {message ? (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
            <button type="submit" className={cn(buttonVariants(), "h-11")} disabled={pending || blocked || !selected}>
              {pending ? "Enrolling…" : "Enroll student"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
