import Link from "next/link";
import { CourseCardView } from "@/features/courses/components/course-card";
import { getCourseProgressBySlug, getFeaturedCourses } from "@/features/courses/queries";
import { getCurrentUser } from "@/server/authz";

export async function FeaturedCourses() {
  const [courses, user] = await Promise.all([getFeaturedCourses(), getCurrentUser()]);
  const progress = user ? await getCourseProgressBySlug(user.id) : {};

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Catalog</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight">Featured courses</h2>
        </div>
        <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground">
          All courses
        </Link>
      </div>
      {courses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No published courses yet.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <CourseCardView key={course.id} course={course} progress={progress[course.slug]} />
          ))}
        </div>
      )}
    </section>
  );
}
