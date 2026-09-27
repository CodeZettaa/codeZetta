"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProgressTrack } from "@/components/progress-track";
import { formatClock } from "@/features/courses/format";
import type { LearningSession } from "@/features/learning/queries";
import { cn } from "cn";

type Module = LearningSession["modules"][number];

export function CurriculumNav({
  courseTitle,
  percent,
  modules,
  courseSlug,
  activeSlug,
  onNavigate,
}: {
  courseTitle: string;
  percent: number;
  modules: Module[];
  courseSlug: string;
  activeSlug: string;
  onNavigate?: () => void;
}) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [trackedSlug, setTrackedSlug] = useState(activeSlug);
  if (trackedSlug !== activeSlug) {
    setTrackedSlug(activeSlug);
    setManual((state) => {
      const current = modules.find((module) => module.lessons.some((lesson) => lesson.slug === activeSlug));
      if (!current || state[current.id] !== false) return state;
      const next = { ...state };
      delete next[current.id];
      return next;
    });
  }

  useEffect(() => {
    const node = activeRef.current;
    const scroller = node?.closest("[data-curriculum-scroll]");
    if (!node || !(scroller instanceof HTMLElement)) return;
    const nodeBox = node.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    const top = nodeBox.top - box.top + scroller.scrollTop - scroller.clientHeight / 2 + nodeBox.height / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }, [activeSlug, manual]);

  return (
    <nav aria-label="Course curriculum" className="flex flex-col">
      <div className="px-4 py-4">
        <p className="text-sm font-medium break-words">{courseTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{percent}% complete</p>
        <ProgressTrack value={percent} label={`Course progress: ${percent} percent`} className="mt-2" />
      </div>
      {modules.map((module) => {
        const containsActive = module.lessons.some((lesson) => lesson.slug === activeSlug);
        const expanded = manual[module.id] ?? containsActive;
        return (
          <section key={module.id}>
            <button
              type="button"
              className="flex min-h-11 w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
              aria-expanded={expanded}
              onClick={() => setManual((current) => ({ ...current, [module.id]: !expanded }))}
            >
              <span className="min-w-0 text-sm font-medium break-words">
                Module {module.position} — {module.title}
              </span>
              <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                {module.completedCount} of {module.lessonCount}
              </span>
            </button>
            {expanded ? (
              <ol className="pb-2">
                {module.lessons.map((lesson) => {
                  const current = lesson.slug === activeSlug;
                  const body = (
                    <>
                      <span className="mt-0.5 w-4 shrink-0 text-xs text-muted-foreground" aria-hidden>
                        {lesson.completed ? "✓" : current ? "●" : ""}
                      </span>
                      <span className={cn("min-w-0 flex-1 break-words", current && "font-medium")}>{lesson.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {lesson.locked
                          ? "Locked"
                          : lesson.durationSeconds > 0
                            ? formatClock(lesson.durationSeconds)
                            : ""}
                      </span>
                    </>
                  );
                  if (lesson.locked) {
                    return (
                      <li key={lesson.id}>
                        <div className="flex min-h-11 items-start gap-2 px-4 py-2 pl-5 text-sm text-muted-foreground" aria-disabled="true">
                          {body}
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={lesson.id}>
                      <Link
                        ref={current ? activeRef : undefined}
                        href={`/learn/${courseSlug}/${lesson.slug}`}
                        aria-current={current ? "page" : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "flex min-h-11 items-start gap-2 px-4 py-2 pl-5 text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          current && "bg-muted",
                        )}
                      >
                        {body}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}
