import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ProgressTrack } from "@/components/progress-track";
import { buttonVariants } from "@/components/ui/button";
import { CourseThumbnail } from "@/features/dashboard/components/course-thumbnail";
import { EnrolledCourseCard } from "@/features/dashboard/components/enrolled-course-card";
import { formatLevel, splitCourseTitle } from "@/features/courses/format";
import { getStudentDashboard } from "@/features/dashboard/queries";
import { formatRelative } from "@/lib/time";
import { requireUser } from "@/server/authz";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const dashboard = await getStudentDashboard(user.id);
  const firstName = user.name?.split(" ")[0] || "there";
  const current = dashboard.continueTarget;
  const title = current ? splitCourseTitle(current.title) : null;
  const others = current ? dashboard.inProgress.filter((course) => course.slug !== current.slug) : dashboard.inProgress;
  const isNew = dashboard.courses.length === 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Dashboard</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
            {isNew ? "Welcome to CodeZetta." : `Welcome back, ${firstName} 👋`}
          </h1>
        </div>
        <div className="flex gap-4">
          <Link
            href="/dashboard/courses"
            className="rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            My courses
          </Link>
          <Link
            href="/dashboard/orders"
            className="rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Orders
          </Link>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="continue-heading">
        <h2 id="continue-heading" className="text-sm font-medium text-muted-foreground">
          Continue learning
        </h2>
        {current && title ? (
          <article className="mt-4 overflow-hidden rounded-2xl border border-foreground/15 bg-card">
            <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
              <CourseThumbnail
                title={title.name}
                thumbnail={current.thumbnail}
                className="aspect-[2/1] w-full object-cover md:aspect-auto md:h-full"
              />
              <div className="p-5 md:p-7">
                <p className="text-sm text-muted-foreground">{formatLevel(current.level)}</p>
                <p className="mt-2 text-xl font-medium tracking-tight">{title.name}</p>
                {title.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{title.subtitle}</p> : null}
                {current.continueLesson ? (
                  <div className="mt-5">
                    <p className="font-mono text-xs tracking-wide text-primary uppercase">Current</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Module {current.continueLesson.modulePosition} — {current.continueLesson.moduleTitle}
                    </p>
                    <h3 className="mt-1 text-lg font-medium tracking-tight">{current.continueLesson.title}</h3>
                  </div>
                ) : null}
                {current.started ? (
                  <div className="mt-5 max-w-md">
                    <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
                      <span>{current.percent}% complete</span>
                    </div>
                    <ProgressTrack
                      value={current.percent}
                      label={`Course progress: ${current.percent} percent`}
                      className="h-2"
                    />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">Not started</p>
                )}
                {current.continueLesson ? (
                  <Link
                    href={`/learn/${current.slug}/${current.continueLesson.slug}`}
                    className={cn(buttonVariants(), "mt-6 h-11 w-full px-4 sm:w-fit")}
                  >
                    {current.started ? "Continue lesson" : "Start course"}
                  </Link>
                ) : null}
                {current.lastActivity ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Last activity {formatRelative(current.lastActivity.at)}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ) : isNew ? (
          <div className="mt-4">
            <EmptyState
              title="Your learning journey starts here."
              body="You haven't started a course yet. Explore CodeZetta courses and start learning."
              actionHref="/courses"
              actionLabel="Explore courses"
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing is in progress. Finished courses are listed below.
          </p>
        )}
      </section>

      {others.length > 0 ? (
        <section className="mt-12" aria-labelledby="my-courses-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="my-courses-heading" className="text-lg font-medium">
              My courses
            </h2>
            <Link href="/dashboard/courses" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-4">
            {others.map((course) => (
              <EnrolledCourseCard key={course.slug} course={course} />
            ))}
          </div>
        </section>
      ) : null}

      {dashboard.recentlyWatched.length > 0 ? (
        <section className="mt-12" aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-lg font-medium">
            Recent activity
          </h2>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {dashboard.recentlyWatched.map((item) => (
              <li key={`${item.courseSlug}-${item.lessonSlug}`}>
                <Link
                  href={`/learn/${item.courseSlug}/${item.lessonSlug}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {item.courseTitle} · {item.moduleTitle}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{formatRelative(item.lastWatchedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dashboard.completedCourses.length > 0 ? (
        <section className="mt-12" aria-labelledby="completed-heading">
          <h2 id="completed-heading" className="text-lg font-medium">
            Completed
          </h2>
          <div className="mt-4 grid gap-4">
            {dashboard.completedCourses.map((course) => (
              <EnrolledCourseCard key={course.slug} course={course} />
            ))}
          </div>
        </section>
      ) : null}

      {dashboard.courses.length > 0 ? (
        <p className="mt-12 text-sm text-muted-foreground">
          <Link href="/dashboard/feedback" className="text-primary hover:underline">
            Send feedback
          </Link>
          <span> about a course. It stays private.</span>
        </p>
      ) : null}
    </main>
  );
}
