"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  archiveLesson,
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  duplicateLesson,
  moveLesson,
  reorderLessons,
  reorderModules,
  restoreLesson,
  restoreModule,
} from "@/features/admin/actions";
import { BoundForm } from "@/features/admin/components/bound-form";
import { useBuilderSession } from "@/features/admin/components/editor-session";
import { formatClock } from "@/features/courses/format";
import { cn } from "cn";

export type EditorLesson = {
  id: string;
  title: string;
  slug: string;
  isPreview: boolean;
  durationSeconds: number;
  videoRef: string | null;
  archivedAt: string | null;
  progressCount: number;
};

export type EditorModule = {
  id: string;
  title: string;
  archivedAt: string | null;
  lessons: EditorLesson[];
};

const ORDER_ERROR = "We couldn't save the new order. Please try again.";

function durationLabel(seconds: number) {
  if (seconds <= 0) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function visibleLessons(module: EditorModule) {
  return module.lessons.filter((lesson) => !lesson.archivedAt);
}

export function CurriculumEditor({
  courseId,
  courseSlug,
  modules,
}: {
  courseId: string;
  courseSlug: string;
  modules: EditorModule[];
}) {
  const signature = modules.map((module) => `${module.id}:${module.lessons.map((lesson) => lesson.id).join(",")}`).join("|");
  const [seen, setSeen] = useState(signature);
  const [items, setItems] = useState(modules);
  const session = useBuilderSession(courseId);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ lessonId: string; moduleId: string } | null>(null);
  const [draggingModule, setDraggingModule] = useState<string | null>(null);

  useEffect(() => {
    const key = `cz-builder:${courseId}:scroll`;
    const saved = Number(sessionStorage.getItem(key) || 0);
    if (saved > 0) window.scrollTo(0, saved);
    const onScroll = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [courseId]);

  if (seen !== signature) {
    setSeen(signature);
    setItems(modules);
  }

  const active = items.filter((module) => !module.archivedAt);
  const archived = items.filter((module) => module.archivedAt);
  const needle = query.trim().toLowerCase();

  function toggle(moduleId: string) {
    const next = new Set(session.closed);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    session.update({ closed: next });
  }

  async function persistLessons(moduleId: string, nextLessons: EditorLesson[], previous: EditorModule[]) {
    setOrderError(null);
    const result = await reorderLessons(
      moduleId,
      nextLessons.filter((lesson) => !lesson.archivedAt).map((lesson) => lesson.id),
    );
    if (!result.ok) {
      setItems(previous);
      setOrderError(ORDER_ERROR);
    }
  }

  async function persistModules(next: EditorModule[], previous: EditorModule[]) {
    setOrderError(null);
    const result = await reorderModules(
      courseId,
      next.filter((module) => !module.archivedAt).map((module) => module.id),
    );
    if (!result.ok) {
      setItems(previous);
      setOrderError(ORDER_ERROR);
    }
  }

  function moveLessonInModule(moduleId: string, lessonId: string, direction: -1 | 1) {
    const previous = items;
    const next = items.map((module) => {
      if (module.id !== moduleId) return module;
      const lessons = [...module.lessons];
      const index = lessons.findIndex((lesson) => lesson.id === lessonId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= lessons.length) return module;
      const [row] = lessons.splice(index, 1);
      if (!row) return module;
      lessons.splice(target, 0, row);
      return { ...module, lessons };
    });
    setItems(next);
    const moved = next.find((item) => item.id === moduleId);
    if (moved) void persistLessons(moduleId, moved.lessons, previous);
  }

  function dropLesson(targetModuleId: string, targetLessonId: string | null) {
    if (!drag) return;
    const previous = items;
    const source = items.find((module) => module.id === drag.moduleId);
    const lesson = source?.lessons.find((item) => item.id === drag.lessonId);
    setDrag(null);
    if (!source || !lesson) return;

    if (drag.moduleId === targetModuleId) {
      const lessons = [...source.lessons];
      const from = lessons.findIndex((item) => item.id === lesson.id);
      const to = targetLessonId ? lessons.findIndex((item) => item.id === targetLessonId) : lessons.length - 1;
      if (from < 0 || to < 0 || from === to) return;
      const [row] = lessons.splice(from, 1);
      if (!row) return;
      lessons.splice(to, 0, row);
      const next = items.map((module) => (module.id === source.id ? { ...module, lessons } : module));
      setItems(next);
      void persistLessons(source.id, lessons, previous);
      return;
    }

    const next = items.map((module) => {
      if (module.id === source.id) return { ...module, lessons: module.lessons.filter((item) => item.id !== lesson.id) };
      if (module.id !== targetModuleId) return module;
      const lessons = [...module.lessons];
      const index = targetLessonId ? lessons.findIndex((item) => item.id === targetLessonId) : lessons.length;
      lessons.splice(index < 0 ? lessons.length : index, 0, lesson);
      return { ...module, lessons };
    });
    setItems(next);
    void moveLesson(lesson.id, targetModuleId, targetLessonId).then((result) => {
      if (!result.ok) {
        setItems(previous);
        setOrderError(ORDER_ERROR);
      }
    });
  }

  function moveModule(moduleId: string, direction: -1 | 1) {
    const previous = items;
    const index = active.findIndex((module) => module.id === moduleId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= active.length) return;
    const nextActive = [...active];
    const [row] = nextActive.splice(index, 1);
    if (!row) return;
    nextActive.splice(target, 0, row);
    const next = [...nextActive, ...archived];
    setItems(next);
    void persistModules(next, previous);
  }

  function reveal(moduleId: string, lessonId: string) {
    setQuery("");
    const next = new Set(session.closed);
    next.delete(moduleId);
    session.update({ closed: next });
    setHighlight(lessonId);
    window.setTimeout(() => {
      document.getElementById(`lesson-${lessonId}`)?.scrollIntoView({ block: "center" });
    }, 0);
  }

  const matches =
    needle.length === 0
      ? []
      : active.flatMap((module) =>
          module.lessons
            .filter((lesson) => !lesson.archivedAt && (lesson.title.toLowerCase().includes(needle) || module.title.toLowerCase().includes(needle)))
            .map((lesson) => ({ module, lesson })),
        );

  return (
    <div>
      {orderError ? <p className="mb-4 text-sm text-destructive">{orderError}</p> : null}
      {active.reduce((total, section) => total + visibleLessons(section).length, 0) > 8 ? (
        <div className="mb-6">
          <label htmlFor="lesson-search" className="sr-only">
            Search lessons
          </label>
          <Input
            id="lesson-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons…"
            className="h-10 max-w-sm"
          />
          {needle ? (
            <ul className="mt-2 max-w-sm border-y border-border">
              {matches.length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">No matching lessons.</li>
              ) : (
                matches.slice(0, 8).map(({ module, lesson }) => (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-sm hover:text-primary"
                      onClick={() => reveal(module.id, lesson.id)}
                    >
                      <span className="truncate">{lesson.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{module.title}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          No modules yet. Start by creating the first section of your course.
        </p>
      ) : (
        <div className="space-y-8">
          {active.map((module, moduleIndex) => {
            const lessons = visibleLessons(module);
            const archivedLessons = module.lessons.filter((lesson) => lesson.archivedAt);
            const seconds = lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0);
            const isClosed = session.closed.has(module.id) && !needle;
            return (
              <section
                key={module.id}
                id={`module-${module.id}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingModule) {
                    const from = active.findIndex((item) => item.id === draggingModule);
                    if (from >= 0 && from !== moduleIndex) {
                      const previous = items;
                      const nextActive = [...active];
                      const [row] = nextActive.splice(from, 1);
                      if (row) {
                        nextActive.splice(moduleIndex, 0, row);
                        const next = [...nextActive, ...archived];
                        setItems(next);
                        void persistModules(next, previous);
                      }
                    }
                    setDraggingModule(null);
                    return;
                  }
                  dropLesson(module.id, null);
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    draggable
                    aria-label={`Drag ${module.title}`}
                    className="mt-1 cursor-grab px-1 font-mono text-xs text-muted-foreground"
                    onDragStart={() => setDraggingModule(module.id)}
                    onDragEnd={() => setDraggingModule(null)}
                  >
                    ⋮⋮
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => toggle(module.id)} aria-expanded={!isClosed}>
                    <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                      Module {String(moduleIndex + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-lg font-medium">{module.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} · {durationLabel(seconds)}
                    </p>
                  </button>
                  <details className="relative">
                    <summary className="cursor-pointer list-none px-2 text-sm text-muted-foreground">⋯</summary>
                    <div className="absolute right-0 z-10 mt-1 w-40 border border-border bg-background py-1 text-sm">
                      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:opacity-40" disabled={moduleIndex === 0} onClick={() => moveModule(module.id, -1)}>
                        Move up
                      </button>
                      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:opacity-40" disabled={moduleIndex === active.length - 1} onClick={() => moveModule(module.id, 1)}>
                        Move down
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          const lessonWithHistory = module.lessons.some((lesson) => lesson.progressCount > 0);
                          const message = lessonWithHistory
                            ? `“${module.title}” has student progress. Archive it instead of deleting?`
                            : `Delete “${module.title}” and its lessons?`;
                          if (window.confirm(message)) void deleteModule(module.id);
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  </details>
                </div>

                {isClosed ? null : lessons.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No lessons yet.</p>
                ) : (
                  <ol className="mt-3 pl-6">
                    {lessons.map((lesson, index) => (
                      <li
                        key={lesson.id}
                        id={`lesson-${lesson.id}`}
                        className={cn(
                          "flex items-center gap-3 border-t border-border py-2",
                          highlight === lesson.id && "bg-muted/60",
                        )}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          dropLesson(module.id, lesson.id);
                        }}
                      >
                        <button
                          type="button"
                          draggable
                          aria-label={`Drag ${lesson.title}`}
                          className="cursor-grab px-1 font-mono text-xs text-muted-foreground"
                          onDragStart={() => setDrag({ lessonId: lesson.id, moduleId: module.id })}
                          onDragEnd={() => setDrag(null)}
                        >
                          ⋮⋮
                        </button>
                        <Link href={`/admin/courses/${courseId}/lessons/${lesson.id}`} className="min-w-0 flex-1 truncate text-sm hover:text-primary">
                          {lesson.title}
                        </Link>
                        <span className="hidden font-mono text-[10px] tracking-wide text-muted-foreground uppercase sm:inline">
                          {lesson.videoRef ? "Video" : "Text"}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{formatClock(lesson.durationSeconds)}</span>
                        <details className="relative">
                          <summary className="cursor-pointer list-none px-2 text-sm text-muted-foreground hover:text-foreground">⋯</summary>
                          <div className="absolute right-0 z-10 mt-1 w-44 border border-border bg-background py-1 text-sm shadow-sm">
                            <Link className="block px-3 py-1.5 hover:bg-muted" href={`/learn/${courseSlug}/${lesson.slug}`}>
                              Preview
                            </Link>
                            <LessonMenu
                              lesson={lesson}
                              modules={active.filter((item) => item.id !== module.id)}
                              onMove={(direction) => moveLessonInModule(module.id, lesson.id, direction)}
                              canUp={index > 0}
                              canDown={index < lessons.length - 1}
                              onMoveTo={(targetId) => {
                                const previous = items;
                                setItems(
                                  items.map((item) => {
                                    if (item.id === module.id) {
                                      return { ...item, lessons: item.lessons.filter((row) => row.id !== lesson.id) };
                                    }
                                    if (item.id === targetId) return { ...item, lessons: [...item.lessons, lesson] };
                                    return item;
                                  }),
                                );
                                void moveLesson(lesson.id, targetId, null).then((result) => {
                                  if (!result.ok) {
                                    setItems(previous);
                                    setOrderError(ORDER_ERROR);
                                  }
                                });
                              }}
                            />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                )}

                <BoundForm action={createLesson.bind(null, module.id)} submitLabel="Create & edit" className="mt-3 flex flex-wrap items-end gap-2 pl-6">
                  <div className="grid min-w-40 flex-1 gap-1">
                    <label htmlFor={`lesson-${module.id}`} className="text-xs text-muted-foreground">
                      Add lesson
                    </label>
                    <Input id={`lesson-${module.id}`} name="title" required placeholder="Lesson title" className="h-9" />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor={`type-${module.id}`} className="text-xs text-muted-foreground">
                      Content
                    </label>
                    <select id={`type-${module.id}`} name="content" defaultValue="video" className="h-9 bg-transparent text-sm">
                      <option value="video">Video</option>
                      <option value="text">Text</option>
                    </select>
                  </div>
                </BoundForm>

                {archivedLessons.length > 0 ? (
                  <ul className="mt-3 text-sm text-muted-foreground">
                    {archivedLessons.map((lesson) => (
                      <li key={lesson.id} className="flex items-center justify-between gap-3 py-1">
                        <span className="truncate">{lesson.title} · archived</span>
                        <button type="button" className="text-foreground hover:text-primary" onClick={() => void restoreLesson(lesson.id)}>
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <BoundForm action={createModule.bind(null, courseId)} submitLabel="Add module" className="mt-10 flex flex-wrap items-end gap-2 border-t border-border pt-6">
        <div className="grid min-w-48 flex-1 gap-1">
          <label htmlFor="module-title" className="text-xs text-muted-foreground">
            Add module
          </label>
          <Input id="module-title" name="title" required placeholder="Module title" className="h-9" />
        </div>
      </BoundForm>

      {archived.length > 0 ? (
        <ul className="mt-6 text-sm text-muted-foreground">
          {archived.map((module) => (
            <li key={module.id} className="flex items-center justify-between gap-3 py-1">
              <span>{module.title} · archived</span>
              <button type="button" className="text-foreground hover:text-primary" onClick={() => void restoreModule(module.id)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LessonMenu({
  lesson,
  modules,
  onMove,
  canUp,
  canDown,
  onMoveTo,
}: {
  lesson: EditorLesson;
  modules: EditorModule[];
  onMove: (direction: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
  onMoveTo: (moduleId: string) => void;
}) {
  return (
    <>
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={() => void duplicateLesson(lesson.id)}>
        Duplicate
      </button>
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:opacity-40" disabled={!canUp} onClick={() => onMove(-1)}>
        Move up
      </button>
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:opacity-40" disabled={!canDown} onClick={() => onMove(1)}>
        Move down
      </button>
      {modules.length > 0 ? (
        <label className="block px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Move to module</span>
          <select
            className="mt-1 w-full bg-transparent"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) onMoveTo(event.target.value);
            }}
          >
            <option value="" disabled>
              Choose
            </option>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left hover:bg-muted"
        onClick={() => {
          if (lesson.progressCount > 0) {
            const archive = window.confirm(
              `This lesson has progress from ${lesson.progressCount} students.\n\nArchive it instead to preserve learning history.`,
            );
            if (archive) void archiveLesson(lesson.id);
            return;
          }
          if (window.confirm(`Delete “${lesson.title}”? It has no student progress.`)) void deleteLesson(lesson.id);
        }}
      >
        {lesson.progressCount > 0 ? "Archive" : "Delete"}
      </button>
    </>
  );
}
