import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { EnrolledCourseCard } from "@/features/dashboard/components/enrolled-course-card";
import type { DashboardCourse } from "@/features/dashboard/queries";
import { getStudentDashboard } from "@/features/dashboard/queries";
import { requireUser } from "@/server/authz";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My courses" };

const sorts = [
  { id: "recent", label: "Recently accessed" },
  { id: "progress", label: "Progress" },
  { id: "name", label: "Course name" },
] as const;

type SortId = (typeof sorts)[number]["id"];

function sortCourses(courses: DashboardCourse[], sort: SortId) {
  const copy = [...courses];
  if (sort === "name") {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "progress") {
    return copy.sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title));
  }
  return copy.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
}

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const user = await requireUser();
  const { sort: rawSort } = await searchParams;
  const sort: SortId = sorts.some((item) => item.id === rawSort) ? (rawSort as SortId) : "recent";
  const dashboard = await getStudentDashboard(user.id);
  const inProgress = sortCourses(dashboard.inProgress, sort);
  const completed = sortCourses(dashboard.completedCourses, sort);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        Dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">My courses</h1>
      <div className="mt-6 flex flex-wrap gap-2" role="navigation" aria-label="Sort courses">
        {sorts.map((item) => (
          <Link
            key={item.id}
            href={item.id === "recent" ? "/dashboard/courses" : `/dashboard/courses?sort=${item.id}`}
            aria-current={sort === item.id ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              sort === item.id && "border-foreground/20 bg-muted text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {dashboard.courses.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="You haven't started a course yet."
            body="Explore CodeZetta courses and start learning."
            actionHref="/courses"
            actionLabel="Explore courses"
          />
        </div>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="text-lg font-medium">In progress</h2>
            {inProgress.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing is in progress. Finished courses are in Completed.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {inProgress.map((course) => (
                  <EnrolledCourseCard key={course.slug} course={course} />
                ))}
              </div>
            )}
          </section>
          <section className="mt-12">
            <h2 className="text-lg font-medium">Completed</h2>
            {completed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                A course appears here after every lesson is finished.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {completed.map((course) => (
                  <EnrolledCourseCard key={course.slug} course={course} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
