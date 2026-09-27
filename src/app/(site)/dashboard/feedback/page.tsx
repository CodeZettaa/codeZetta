import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import { getFeedbackCourses } from "@/features/feedback/queries";
import { requireUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Send feedback" };

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; courseId?: string; lessonId?: string }>;
}) {
  const user = await requireUser("/dashboard/feedback");
  const { sent, courseId, lessonId } = await searchParams;
  const enrollments = await getFeedbackCourses(user.id);
  const courses = enrollments.map((enrollment) => enrollment.course);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-16">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        Dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Send feedback</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        A private note to the instructor. This is not a public review.
      </p>
      {sent === "1" ? (
        <p className="mt-6 rounded-xl border border-primary/40 px-4 py-3 text-sm" role="status">
          Thanks — your feedback was sent.
        </p>
      ) : null}
      {courses.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Feedback opens after you enroll."
            body="Once a course is on your dashboard, you can send a private note about it."
            actionHref="/courses"
            actionLabel="Explore courses"
          />
        </div>
      ) : (
        <div className="mt-8">
          <FeedbackForm courses={courses} initialCourseId={courseId} initialLessonId={lessonId} />
        </div>
      )}
    </main>
  );
}
