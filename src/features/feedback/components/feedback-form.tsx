"use client";

import { useActionState, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fieldControl } from "@/features/admin/components/course-fields";
import { submitFeedback } from "@/features/feedback/actions";
import { cn } from "cn";

type CourseOption = {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
};

const types = [
  { id: "CONTENT", label: "Content" },
  { id: "TECHNICAL_ISSUE", label: "Technical issue" },
  { id: "SUGGESTION", label: "Suggestion" },
  { id: "OTHER", label: "Other" },
] as const;

export function FeedbackForm({
  courses,
  initialCourseId,
  initialLessonId,
}: {
  courses: CourseOption[];
  initialCourseId?: string;
  initialLessonId?: string;
}) {
  const [message, formAction, pending] = useActionState(submitFeedback, null);
  const startingCourse = courses.some((course) => course.id === initialCourseId) ? initialCourseId : courses[0]?.id;
  const [courseId, setCourseId] = useState(startingCourse ?? "");
  const lessons = useMemo(
    () => courses.find((course) => course.id === courseId)?.lessons ?? [],
    [courses, courseId],
  );
  const lessonDefault = lessons.some((lesson) => lesson.id === initialLessonId) ? initialLessonId : "";

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="feedback-course">Course</Label>
        <select
          id="feedback-course"
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
      <div className="grid gap-2">
        <Label htmlFor="feedback-lesson">Lesson</Label>
        <select id="feedback-lesson" name="lessonId" className={fieldControl} defaultValue={lessonDefault} key={courseId}>
          <option value="">Whole course</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {types.map((type) => (
            <label key={type.id} className="flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
              <input type="radio" name="type" value={type.id} required className="size-4" defaultChecked={type.id === "CONTENT"} />
              {type.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="feedback-message">Message</Label>
        <textarea id="feedback-message" name="message" required minLength={10} maxLength={2000} rows={6} className={fieldControl} />
      </div>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants(), "h-11 w-fit px-4")}>
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
