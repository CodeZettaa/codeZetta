"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { Course } from "@prisma/client";
import { duplicateCourse, publishCourse, setCourseStatus, updateCourse } from "@/features/admin/actions";
import { BoundForm } from "@/features/admin/components/bound-form";
import { CourseFields } from "@/features/admin/components/course-fields";
import type { PublishIssue, ReadinessItem } from "@/features/admin/curriculum";
import { useBuilderSession } from "@/features/admin/components/editor-session";
import { formatRelative } from "@/lib/time";
import { cn } from "cn";

const tabs = ["content", "details", "pricing", "settings"] as const;
type Tab = (typeof tabs)[number];

export function CourseWorkspace({
  courseId,
  title,
  status,
  slug,
  updatedAt,
  enrolled,
  readiness,
  course,
  curriculum,
}: {
  courseId: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  slug: string;
  updatedAt: string;
  enrolled: number;
  readiness: ReadinessItem[];
  course: Course;
  curriculum: ReactNode;
}) {
  const session = useBuilderSession(courseId);
  const tab: Tab = tabs.includes(session.tab as Tab) ? (session.tab as Tab) : "content";
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<PublishIssue[] | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function publish() {
    setBlocked(null);
    startTransition(async () => {
      const result = await publishCourse(courseId);
      setConfirming(false);
      if (!result.ok) {
        setBlocked(result.issues);
        return;
      }
      setPublishedSlug(result.slug);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/courses" className="hover:text-foreground">
              ← Courses
            </Link>
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "DRAFT" ? "Draft" : status === "PUBLISHED" ? "Published" : "Archived"}
            {" · "}
            Last saved {formatRelative(new Date(updatedAt))}
            {enrolled > 0 ? ` · ${enrolled} enrolled` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/courses/${slug}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
            Preview
          </Link>
          {status === "PUBLISHED" ? (
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}
              onClick={() => {
                const message =
                  enrolled > 0
                    ? `Unpublish ${title}? It leaves the public catalog. ${enrolled} enrolled students keep access.`
                    : `Unpublish ${title}? It leaves the public catalog.`;
                if (!window.confirm(message)) return;
                startTransition(() => setCourseStatus(courseId, "DRAFT"));
              }}
            >
              Unpublish
            </button>
          ) : (
            <button type="button" className={cn(buttonVariants(), "h-9 px-3")} onClick={() => setConfirming(true)}>
              Publish course
            </button>
          )}
        </div>
      </div>

      {publishedSlug ? (
        <p className="mt-4 text-sm">
          {title} is now published.{" "}
          <Link href={`/courses/${publishedSlug}`} className="text-primary hover:underline">
            View course
          </Link>
        </p>
      ) : null}

      {blocked ? (
        <div className="mt-4 max-w-xl">
          <p className="text-sm font-medium">Course isn&apos;t ready to publish</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {blocked.length} {blocked.length === 1 ? "issue needs" : "issues need"} attention
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {blocked.map((issue) => (
              <li key={`${issue.moduleTitle ?? ""}-${issue.message}`}>
                {issue.moduleTitle ? <span className="text-muted-foreground">{issue.moduleTitle} — </span> : null}
                {issue.message}{" "}
                {issue.href ? (
                  <a href={issue.href} className="text-primary hover:underline">
                    Fix
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirming ? (
        <div className="mt-4 max-w-md border border-border p-4" role="dialog" aria-labelledby="publish-title">
          <p id="publish-title" className="text-sm font-medium">
            Publish {title}?
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Once published, students can discover and access this course according to its enrollment rules.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className={cn(buttonVariants(), "h-9 px-3")} disabled={pending} onClick={publish}>
              {pending ? "Publishing…" : "Publish course"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex gap-4 border-b border-border" role="tablist">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={cn(
              "border-b-2 border-transparent pb-2 text-sm capitalize text-muted-foreground",
              tab === item && "border-foreground text-foreground",
            )}
            onClick={() => session.update({ tab: item })}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {readiness.map((item) => (
            <li key={item.label}>
              {item.ok ? "✓" : "⚠"} {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6" hidden={tab !== "content"}>
        {curriculum}
      </div>
      <div className="mt-6 max-w-xl" hidden={tab === "content"}>
        <BoundForm action={updateCourse.bind(null, courseId)} submitLabel="Save" className="grid gap-4">
          <CourseFields
            course={course}
            panel={tab === "pricing" ? "pricing" : tab === "settings" ? "settings" : "details"}
          />
        </BoundForm>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/admin/enrollments" className="hover:text-foreground">
            View students
          </Link>
          {" · "}
          <button type="button" className="hover:text-foreground" onClick={() => void duplicateCourse(courseId)}>
            Duplicate course
          </button>
        </p>
      </div>
    </div>
  );
}
