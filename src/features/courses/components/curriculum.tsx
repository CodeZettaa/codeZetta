import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatClock, formatDuration } from "@/features/courses/format";
import type { CourseDetail } from "@/features/courses/queries";

export function Curriculum({
  courseSlug,
  modules,
}: {
  courseSlug: string;
  modules: CourseDetail["modules"];
}) {
  return (
    <ol className="space-y-3">
      {modules.map((module, moduleIndex) => {
        const seconds = module.lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0);
        return (
          <li key={module.id} className="rounded-2xl border border-border bg-card/40">
            <details className="group" open={moduleIndex === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="font-mono text-xs text-primary">
                    {String(module.position).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-base font-medium">{module.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {module.lessons.length} lessons · {formatDuration(seconds)}
                  </span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <ol className="border-t border-border">
                {module.lessons.map((lesson, index) => (
                  <li
                    key={lesson.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-sm not-last:border-b not-last:border-border/70"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate">{lesson.title}</span>
                      {lesson.isPreview ? (
                        <Link
                          href={`/learn/${courseSlug}/${lesson.slug}`}
                          className="shrink-0 font-mono text-[10px] tracking-wide text-primary uppercase"
                        >
                          Preview
                        </Link>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatClock(lesson.durationSeconds)}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
