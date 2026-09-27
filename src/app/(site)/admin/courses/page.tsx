import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { getAdminCourses } from "@/features/admin/queries";
import { formatLevel } from "@/features/courses/format";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Courses" };

export default async function AdminCoursesPage() {
  const courses = await getAdminCourses();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/courses" />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Courses</h1>
          <p className="mt-2 text-sm text-muted-foreground">Drafts stay out of the catalog until you publish them.</p>
        </div>
        <Link href="/admin/courses/new" className={cn(buttonVariants(), "h-10 px-4")}>
          New course
        </Link>
      </div>
      {courses.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No courses yet."
            body="Create a course, then add modules and lessons."
            actionHref="/admin/courses/new"
            actionLabel="New course"
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Content</th>
                <th className="px-4 py-3 font-medium">Students</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/courses/${course.id}`} className="font-medium hover:text-primary">
                      {course.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{formatLevel(course.level)}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{course.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {course._count.modules} modules · {course._count.lessons} lessons
                  </td>
                  <td className="px-4 py-3">{course._count.enrollments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
