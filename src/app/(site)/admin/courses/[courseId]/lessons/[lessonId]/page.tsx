import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { LessonEditorForm } from "@/features/admin/components/lesson-editor-form";
import { ResourceList } from "@/features/admin/components/resource-list";
import { getAdminLesson } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

type LessonEditorProps = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ focus?: string }>;
};

export async function generateMetadata({ params }: LessonEditorProps): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await getAdminLesson(lessonId);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonEditorPage({ params, searchParams }: LessonEditorProps) {
  const { courseId, lessonId } = await params;
  const { focus } = await searchParams;
  const lesson = await getAdminLesson(lessonId);
  if (!lesson || lesson.courseId !== courseId) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <AdminNav current="/admin/courses" />
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href={`/admin/courses/${courseId}`} className="hover:text-foreground">
          ← {lesson.course.title}
        </Link>
        <span> · {lesson.module.title}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{lesson.title}</h1>
        <Link href={`/learn/${lesson.course.slug}/${lesson.slug}`} className="text-sm text-primary hover:underline">
          Preview lesson
        </Link>
      </div>

      <LessonEditorForm
        courseId={courseId}
        courseStatus={lesson.course.status}
        lessonId={lesson.id}
        updatedAt={lesson.updatedAt.toISOString()}
        title={lesson.title}
        slug={lesson.slug}
        description={lesson.description}
        minutes={Math.floor(lesson.durationSeconds / 60)}
        seconds={lesson.durationSeconds % 60}
        videoRef={lesson.videoRef}
        isPreview={lesson.isPreview}
        focusVideo={focus === "video"}
      />

      <ResourceList
        courseId={courseId}
        lessonId={lesson.id}
        resources={lesson.resources.map((resource) => ({
          id: resource.id,
          title: resource.title,
          url: resource.url,
          kind: resource.kind,
        }))}
      />
    </main>
  );
}
