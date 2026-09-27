import type { Metadata } from "next";
import { CourseCardView } from "@/features/courses/components/course-card";
import { getCourseProgressBySlug, getPublishedCourses } from "@/features/courses/queries";
import { getCurrentUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Courses",
  description: "Software engineering courses from CodeZetta.",
};

export default async function CoursesPage() {
  const [courses, user] = await Promise.all([getPublishedCourses(), getCurrentUser()]);
  const progress = user ? await getCourseProgressBySlug(user.id) : {};

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Catalog</p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">Courses</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
        Focused courses in frontend engineering, JavaScript, and Angular. Published work only.
      </p>
      {courses.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <p className="text-sm text-muted-foreground">No published courses yet.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <CourseCardView key={course.id} course={course} progress={progress[course.slug]} />
          ))}
        </div>
      )}
    </main>
  );
}
