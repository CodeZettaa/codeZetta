import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject, deleteCourse, deleteProject, setCourseStatus } from "@/features/admin/actions";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { BoundForm } from "@/features/admin/components/bound-form";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { fieldControl } from "@/features/admin/components/course-fields";
import { CourseWorkspace } from "@/features/admin/components/course-workspace";
import { CurriculumEditor } from "@/features/admin/components/curriculum-editor";
import { courseReadiness } from "@/features/admin/curriculum";
import { getAdminCourse } from "@/features/admin/queries";
import { getReviewSummary } from "@/features/reviews/queries";

export const dynamic = "force-dynamic";

type BuilderProps = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: BuilderProps): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getAdminCourse(courseId);
  return { title: course?.title ?? "Course builder" };
}

export default async function CourseBuilderPage({ params }: BuilderProps) {
  const { courseId } = await params;
  const course = await getAdminCourse(courseId);
  if (!course) notFound();
  const reviews = await getReviewSummary(course.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <AdminNav current="/admin/courses" />
      <p className="mt-4 text-sm text-muted-foreground">
        {reviews.count === 0 ? "No reviews yet" : `${reviews.average} out of 5 stars · ${reviews.count} reviews`}
      </p>
      <div className="mt-8">
        <CourseWorkspace
          courseId={course.id}
          course={course}
          title={course.title}
          status={course.status}
          slug={course.slug}
          updatedAt={course.updatedAt.toISOString()}
          enrolled={course._count.enrollments}
          readiness={courseReadiness({
            title: course.title,
            description: course.description,
            thumbnail: course.thumbnail,
            modules: course.modules.map((module) => ({
              title: module.title,
              archivedAt: module.archivedAt,
              lessons: module.lessons.map((lesson) => ({
                title: lesson.title,
                archivedAt: lesson.archivedAt,
                videoRef: lesson.videoRef,
                description: lesson.description,
              })),
            })),
          })}
          curriculum={
            <CurriculumEditor
              courseId={course.id}
              courseSlug={course.slug}
              modules={course.modules.map((module) => ({
                id: module.id,
                title: module.title,
                archivedAt: module.archivedAt?.toISOString() ?? null,
                lessons: module.lessons.map((lesson) => ({
                  id: lesson.id,
                  title: lesson.title,
                  slug: lesson.slug,
                  isPreview: lesson.isPreview,
                  durationSeconds: lesson.durationSeconds,
                  videoRef: lesson.videoRef,
                  archivedAt: lesson.archivedAt?.toISOString() ?? null,
                  progressCount: lesson._count.progress,
                })),
              }))}
            />
          }
        />
      </div>

      <section className="mt-16 border-t border-border pt-8">
        <h2 className="text-sm font-medium">Projects</h2>
        <ul className="mt-3">
          {course.projects.map((project) => (
            <li key={project.id} className="flex items-start justify-between gap-4 border-t border-border py-3">
              <div>
                <p className="text-sm font-medium">{project.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              </div>
              <ConfirmSubmit
                label="Delete"
                confirm={`Delete “${project.title}”?`}
                variant="destructive"
                action={deleteProject.bind(null, project.id)}
              />
            </li>
          ))}
        </ul>
        <BoundForm action={createProject.bind(null, course.id)} submitLabel="Add project" className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="project-title">Title</Label>
            <Input id="project-title" name="title" required className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <textarea id="project-description" name="description" required rows={3} className={fieldControl} />
          </div>
        </BoundForm>
      </section>

      <div className="mt-12 border-t border-border pt-6">
        {course._count.enrollments > 0 ? (
          <ConfirmSubmit
            label="Archive course"
            confirm={`Archive “${course.title}”? It leaves the catalog. ${course._count.enrollments} enrolled students keep access and their progress.`}
            action={setCourseStatus.bind(null, course.id, "ARCHIVED")}
          />
        ) : (
          <ConfirmSubmit
            label="Delete course"
            confirm={`Delete “${course.title}”? It has no enrolled students.`}
            variant="destructive"
            action={deleteCourse.bind(null, course.id)}
          />
        )}
      </div>
    </main>
  );
}
