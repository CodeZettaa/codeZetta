import type { Metadata } from "next";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { BoundForm } from "@/features/admin/components/bound-form";
import { CourseFields } from "@/features/admin/components/course-fields";
import { createCourse } from "@/features/admin/actions";
import { requireAdmin } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/courses" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">New course</h1>
      <BoundForm action={createCourse} submitLabel="Create course" className="mt-8 grid gap-4">
        <CourseFields panel="all" />
      </BoundForm>
    </main>
  );
}
