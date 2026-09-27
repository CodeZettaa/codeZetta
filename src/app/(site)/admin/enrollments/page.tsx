import type { Metadata } from "next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { cancelEnrollment, enrollStudent } from "@/features/admin/actions";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { BoundForm } from "@/features/admin/components/bound-form";
import { fieldControl } from "@/features/admin/components/course-fields";
import { getAdminEnrollments } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Enrollments" };

export default async function EnrollmentsPage() {
  const { courses, enrollments } = await getAdminEnrollments();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/enrollments" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">Enrollments</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Grant access to an existing account. A payment webhook can call the same enrollment write later.
      </p>

      <BoundForm action={enrollStudent} submitLabel="Grant access" className="mt-8 grid max-w-xl gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Student email</Label>
          <Input id="email" name="email" type="email" required className="h-10" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="courseId">Course</Label>
          <select id="courseId" name="courseId" required className={fieldControl} defaultValue="">
            <option value="" disabled>
              Select a course
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </BoundForm>

      {enrollments.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No enrollments yet.</p>
      ) : (
        <ul className="mt-10 grid gap-3">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{enrollment.user.name || enrollment.user.email}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{enrollment.user.email}</p>
                  <p className="mt-2 text-sm">{enrollment.course.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={enrollment.status} />
                    <span className="text-xs text-muted-foreground">{enrollment.source}</span>
                  </div>
                </div>
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
