import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressTrack } from "@/components/progress-track";
import { CourseThumbnail } from "@/features/dashboard/components/course-thumbnail";
import { formatLevel, splitCourseTitle } from "@/features/courses/format";
import type { DashboardCourse } from "@/features/dashboard/queries";
import { buttonVariants } from "@/components/ui/button";
import { formatRelative } from "@/lib/time";
import { cn } from "cn";

export function EnrolledCourseCard({ course }: { course: DashboardCourse }) {
  const { name, subtitle } = splitCourseTitle(course.title);
  const href = course.continueLesson
    ? `/learn/${course.slug}/${course.continueLesson.slug}`
    : `/courses/${course.slug}`;
  const finished = course.percent === 100 || course.status === "COMPLETED";
  const label = finished ? "Review course" : course.started ? "Continue learning" : "Start course";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20 md:flex-row">
      <CourseThumbnail
        title={name}
        thumbnail={course.thumbnail}
        className="aspect-[2/1] w-full object-cover md:aspect-auto md:w-44 md:shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatLevel(course.level)}</Badge>
          {finished ? <Badge variant="secondary">Completed</Badge> : null}
        </div>
        <h3 className="mt-3 text-lg font-medium tracking-tight">{name}</h3>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        {course.started ? (
          <div className="mt-4 max-w-sm">
            <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
              <span>{course.percent}% complete</span>
              <span>
                {course.completedLessons}/{course.lessonCount} lessons
              </span>
            </div>
            <ProgressTrack value={course.percent} label={`${name} progress`} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Not started</p>
        )}
        {course.continueLesson && !finished ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Module {course.continueLesson.modulePosition} — {course.continueLesson.moduleTitle}
            <span className="text-foreground"> · {course.continueLesson.title}</span>
          </p>
        ) : null}
        {course.lastActivity ? (
          <p className="mt-1 text-sm text-muted-foreground">Last activity {formatRelative(course.lastActivity.at)}</p>
        ) : null}
        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link href={href} className={cn(buttonVariants(), "h-11 w-full px-4 sm:w-fit")}>
            {label}
          </Link>
          {course.percent >= 20 ? (
            <Link href={`/courses/${course.slug}#reviews`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Share your experience
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
