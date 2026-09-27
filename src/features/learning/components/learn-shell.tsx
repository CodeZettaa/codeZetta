"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { ProgressTrack } from "@/components/progress-track";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CurriculumNav } from "@/features/learning/components/curriculum-nav";
import { completionPercent } from "@/features/learning/progress";
import type { LearningSession } from "@/features/learning/queries";

type Module = LearningSession["modules"][number];

type ProgressState = {
  modules: Module[];
  percent: number;
  completedLessons: number;
  lessonCount: number;
  mark: (slug: string, completed: boolean) => void;
};

const LearningProgressContext = createContext<ProgressState | null>(null);

export function useLearningProgress() {
  return useContext(LearningProgressContext);
}

export function LearnShell({
  courseTitle,
  courseSlug,
  percent,
  completedLessons,
  lessonCount,
  modules,
  children,
}: {
  courseTitle: string;
  courseSlug: string;
  percent: number;
  completedLessons: number;
  lessonCount: number;
  modules: Module[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeSlug = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const [drawer, setDrawer] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const signature = `${percent}:${completedLessons}:${modules.map((module) => module.completedCount).join(".")}`;
  const [progress, setProgress] = useState(() => ({ modules, percent, completedLessons, lessonCount }));
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setProgress({ modules, percent, completedLessons, lessonCount });
  }

  const value = useMemo<ProgressState>(
    () => ({
      ...progress,
      mark: (slug, completed) => {
        setProgress((current) => {
          const nextModules = current.modules.map((module) => {
            const lessons = module.lessons.map((lesson) => (lesson.slug === slug ? { ...lesson, completed } : lesson));
            return {
              ...module,
              lessons,
              completedCount: lessons.filter((lesson) => lesson.completed).length,
            };
          });
          const lessons = nextModules.flatMap((module) => module.lessons);
          const done = lessons.filter((lesson) => lesson.completed).length;
          return {
            modules: nextModules,
            completedLessons: done,
            lessonCount: lessons.length,
            percent: completionPercent(done, lessons.length),
          };
        });
      },
    }),
    [progress],
  );

  const curriculum = (
    <CurriculumNav
      courseTitle={courseTitle}
      percent={progress.percent}
      modules={progress.modules}
      courseSlug={courseSlug}
      activeSlug={activeSlug}
      onNavigate={() => setDrawer(false)}
    />
  );

  return (
    <LearningProgressContext.Provider value={value}>
      <div className="flex min-h-svh w-full flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="flex items-center gap-2 px-3 py-2 md:gap-3 md:px-5">
            <Link
              href="/dashboard"
              className="inline-flex h-11 shrink-0 items-center text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Dashboard
            </Link>
            <p className="min-w-0 flex-1 truncate text-sm">{courseTitle}</p>
            <p className="hidden text-xs text-muted-foreground md:block">{progress.percent}%</p>
            <div className="hidden w-24 lg:block">
              <ProgressTrack value={progress.percent} label={`Course progress: ${progress.percent} percent`} />
            </div>
            <Button type="button" variant="outline" className="h-11 px-3 lg:hidden" onClick={() => setDrawer(true)}>
              Curriculum
            </Button>
            <Button
              type="button"
              variant="outline"
              className="hidden h-11 px-3 lg:inline-flex"
              aria-expanded={sidebar}
              onClick={() => setSidebar((open) => !open)}
            >
              {sidebar ? "Hide curriculum" : "Show curriculum"}
            </Button>
          </div>
        </header>
        <div className={sidebar ? "grid min-h-0 flex-1 lg:grid-cols-[18.5rem_minmax(0,1fr)]" : "min-h-0 flex-1"}>
          {sidebar ? (
            <aside
              data-curriculum-scroll
              className="hidden max-h-[calc(100svh-3.75rem)] overflow-y-auto border-r border-border lg:block"
            >
              {curriculum}
            </aside>
          ) : null}
          <div className="min-w-0">{children}</div>
        </div>
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent
            side="bottom"
            className="h-[min(80svh,40rem)] overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] motion-reduce:transition-none"
          >
            <SheetHeader className="border-b border-border pr-12">
              <SheetTitle>Curriculum</SheetTitle>
            </SheetHeader>
            <div data-curriculum-scroll className="min-h-0 flex-1 overflow-y-auto">
              {curriculum}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </LearningProgressContext.Provider>
  );
}
