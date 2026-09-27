import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressTrack } from "@/components/progress-track";
import { formatDuration, formatLevel, splitCourseTitle } from "@/features/courses/format";
import type { CourseCard } from "@/features/courses/queries";

export function CourseCardView({
  course,
  progress,
}: {
  course: CourseCard;
  progress?: { percent: number; continueLessonSlug: string | null; started: boolean };
}) {
  const { name, subtitle } = splitCourseTitle(course.title);
  const href =
    progress?.continueLessonSlug != null
      ? `/learn/${course.slug}/${progress.continueLessonSlug}`
      : `/courses/${course.slug}`;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/20">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{formatLevel(course.level)}</Badge>
      </div>
      <h3 className="mt-5 text-xl font-medium tracking-tight">
        <Link href={`/courses/${course.slug}`} className="hover:text-primary">
          {name}
        </Link>
      </h3>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      <p className="mt-5 text-sm text-muted-foreground">
        {course._count.modules} modules · {formatDuration(course.durationSeconds)} · {course._count.projects}{" "}
        {course._count.projects === 1 ? "project" : "projects"}
      </p>
      {progress?.started ? (
        <div className="mt-5">
          <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress.percent}%</span>
          </div>
          <ProgressTrack value={progress.percent} label={`${name} progress`} />
        </div>
      ) : progress ? (
        <p className="mt-5 text-sm text-muted-foreground">Not started</p>
      ) : (
        <div className="flex-1" />
      )}
      <Link href={href} className="mt-6 text-sm font-medium text-primary">
        {progress ? (progress.started ? "Continue learning →" : "Start course →") : "View course →"}
      </Link>
    </article>
  );
}
