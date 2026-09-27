import { CourseGridSkeleton } from "@/features/courses/components/course-grid-skeleton";

export default function CoursesLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8">
      <div className="mb-12 h-16" />
      <CourseGridSkeleton />
    </main>
  );
}
