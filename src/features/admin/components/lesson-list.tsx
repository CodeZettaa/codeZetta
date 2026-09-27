"use client";

import Link from "next/link";
import { useState } from "react";
import { GripVertical } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { deleteLesson, duplicateLesson, reorderLessons } from "@/features/admin/actions";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { formatClock } from "@/features/courses/format";
import { cn } from "cn";

export type BuilderLesson = {
  id: string;
  title: string;
  isPreview: boolean;
  durationSeconds: number;
};

export function LessonList({
  courseId,
  moduleId,
  lessons,
}: {
  courseId: string;
  moduleId: string;
  lessons: BuilderLesson[];
}) {
  const [items, setItems] = useState(lessons);
  const [dragId, setDragId] = useState<string | null>(null);

  async function commit(next: BuilderLesson[]) {
    const previous = items;
    setItems(next);
    try {
      const result = await reorderLessons(moduleId, next.map((lesson) => lesson.id));
      if (!result.ok) setItems(previous);
    } catch {
      setItems(previous);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(target, 0, row);
    void commit(next);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((lesson) => lesson.id === dragId);
    const to = items.findIndex((lesson) => lesson.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    if (!row) return;
    next.splice(to, 0, row);
    setDragId(null);
    void commit(next);
  }

  if (items.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">No lessons in this module yet.</p>;
  }

  return (
    <ol>
      {items.map((lesson, index) => (
        <li
          key={lesson.id}
          className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => dropOn(lesson.id)}
        >
          <button
            type="button"
            draggable
            aria-label={`Drag ${lesson.title}`}
            className="cursor-grab text-muted-foreground"
            onDragStart={() => setDragId(lesson.id)}
            onDragEnd={() => setDragId(null)}
          >
            <GripVertical className="size-4" />
          </button>
          <Link
            href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
            className="min-w-0 flex-1 truncate text-sm hover:text-primary"
          >
            {String(index + 1).padStart(2, "0")} {lesson.title}
          </Link>
          {lesson.isPreview ? (
            <span className="font-mono text-[10px] tracking-wide text-primary uppercase">Preview</span>
          ) : null}
          <span className="font-mono text-xs text-muted-foreground">{formatClock(lesson.durationSeconds)}</span>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
            aria-label={`Move ${lesson.title} up`}
            onClick={() => move(index, -1)}
          >
            Up
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
            aria-label={`Move ${lesson.title} down`}
            onClick={() => move(index, 1)}
          >
            Down
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
            onClick={() => void duplicateLesson(lesson.id)}
          >
            Duplicate
          </button>
          <ConfirmSubmit
            label="Delete"
            confirm={`Delete “${lesson.title}”? This removes its progress records.`}
            variant="destructive"
            action={() => deleteLesson(lesson.id)}
          />
        </li>
      ))}
    </ol>
  );
}
