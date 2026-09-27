import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { cancelEnrollment } from "@/features/admin/actions";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { EnrollStudentDialog } from "@/features/admin/components/enroll-student-dialog";
import { getAdminStudent, getEnrollmentCourseOptions } from "@/features/admin/queries";
import { formatDate, formatRelative } from "@/lib/time";

export const dynamic = "force-dynamic";

type StudentPageProps = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: StudentPageProps): Promise<Metadata> {
  const { userId } = await params;
  const student = await getAdminStudent(userId);
  return { title: student?.name || student?.email || "Student" };
}

export default async function StudentDetailPage({ params }: StudentPageProps) {
  const { userId } = await params;
  const [student, courses] = await Promise.all([getAdminStudent(userId), getEnrollmentCourseOptions(userId)]);
  if (!student) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/students" />
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/admin/students" className="hover:text-foreground">
          Students
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{student.name || "Unnamed student"}</h1>
      <p className="mt-1 break-all text-sm text-muted-foreground">{student.email}</p>
      <p className="mt-1 text-sm text-muted-foreground">Joined {formatDate(student.createdAt)}</p>

      <section className="mt-10" aria-labelledby="enrollments-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="enrollments-heading" className="text-lg font-medium">
            Enrollments
          </h2>
          <EnrollStudentDialog userId={student.id} courses={courses} />
        </div>
        {student.enrollments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">This student is not enrolled in a course.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {student.enrollments.map((enrollment) => (
              <li key={enrollment.id} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{enrollment.course.title}</p>
                    <div className="mt-2">
                      <StatusBadge status={enrollment.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Enrolled {formatDate(enrollment.enrolledAt)}</p>
                    {enrollment.status !== "CANCELLED" ? (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Progress: {enrollment.completedLessons} / {enrollment.lessonCount} lessons
                          {enrollment.lessonCount > 0 ? ` · ${enrollment.percent}%` : ""}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {enrollment.lastActivity
                            ? `Last activity ${formatRelative(enrollment.lastActivity.at)} · ${enrollment.lastActivity.lessonTitle}`
                            : "Not started"}
                        </p>
                        {enrollment.currentLesson && enrollment.percent < 100 ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Current lesson: {enrollment.currentLesson.moduleTitle} — {enrollment.currentLesson.title}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href={`/courses/${enrollment.course.slug}`} className="text-sm text-primary">
                      View
                    </Link>
                    {enrollment.status !== "CANCELLED" ? (
                      <ConfirmDialog
                        triggerLabel="Cancel enrollment"
                        title="Cancel enrollment?"
                        body="The student will lose access to this course."
                        confirmLabel="Cancel enrollment"
                        cancelLabel="Keep enrollment"
                        action={cancelEnrollment.bind(null, enrollment.id)}
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
