import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnShell } from "@/features/learning/components/learn-shell";
import { LessonControls } from "@/features/learning/components/lesson-controls";
import { LessonFeedback } from "@/features/learning/components/lesson-feedback";
import { VideoPlayer } from "@/features/learning/components/video-player";
import { getLearningSession, type LearningSession } from "@/features/learning/queries";
import { getCurrentUser } from "@/server/authz";

export const dynamic = "force-dynamic";

type LearnPageProps = {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
};

export async function generateMetadata({ params }: LearnPageProps): Promise<Metadata> {
  const { courseSlug, lessonSlug } = await params;
  const user = await getCurrentUser();
  const session = await getLearningSession({
    courseSlug,
    lessonSlug,
    userId: user?.id ?? null,
    role: user?.role ?? null,
  });
  if (!session?.canWatch) return { title: "Lesson" };
  return { title: session.lesson.title };
}

function resourceKind(title: string, url: string, kind?: string) {
  if (kind === "PDF") return "PDF";
  if (kind === "SLIDES") return "Slides";
  if (kind === "SOURCE") return url.toLowerCase().includes("github") ? "GitHub" : "Source";
  if (kind === "EXERCISE") return "Exercise";
  if (kind === "OTHER") return "File";
  const value = `${title} ${url}`.toLowerCase();
  if (value.includes("github")) return "GitHub";
  if (value.includes(".pdf") || value.includes("pdf")) return "PDF";
  if (value.includes("slide")) return "Slides";
  if (value.includes(".zip") || value.includes("exercise")) return "ZIP";
  return "Link";
}

function LessonColumn({ session, userId, role }: { session: LearningSession; userId: string | null; role: "STUDENT" | "ADMIN" | null }) {
  const moduleInfo = session.modules.find((module) => module.id === session.lesson.moduleId);
  const resources = session.resources;
  const feedback =
    userId && session.enrolled && role !== "ADMIN" ? (
      <LessonFeedback
        courseId={session.course.id}
        lessonId={session.lesson.id}
        route={`/learn/${session.course.slug}/${session.lesson.slug}`}
        label={session.course.percent >= 100 ? "Send course feedback" : "Send feedback"}
      />
    ) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-8 md:py-8">
      {role === "ADMIN" ? (
        <p className="mb-3 text-sm font-medium tracking-wide text-primary uppercase">Preview mode</p>
      ) : session.lesson.isPreview && !session.enrolled ? (
        <p className="mb-3 text-sm text-primary">Free preview</p>
      ) : null}
      <VideoPlayer
        key={session.lesson.id}
        lessonId={session.lesson.id}
        playback={session.playback}
        hasVideo={session.hasVideo}
        startSeconds={role === "ADMIN" ? 0 : session.lesson.lastPosition}
        trackProgress={Boolean(userId && session.enrolled && role !== "ADMIN")}
      />

      <p className="mt-6 text-sm text-muted-foreground">
        Module {session.lesson.modulePosition} — {session.lesson.moduleTitle}
        {moduleInfo ? ` · ${moduleInfo.completedCount} of ${moduleInfo.lessonCount} lessons` : ""}
      </p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight text-balance md:text-3xl">{session.lesson.title}</h1>
      {session.lesson.description ? (
        <div className="mt-4 max-w-2xl space-y-3 text-sm leading-6 text-muted-foreground">
          {session.lesson.description.split(/\n\n+/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {session.enrolled && session.course.percent >= 20 && session.course.percent < 100 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Enjoying {session.course.title.split(": ")[0]}?{" "}
          <Link href={`/courses/${session.course.slug}#reviews`} className="underline-offset-4 hover:underline">
            Share your experience
          </Link>
        </p>
      ) : null}

      <LessonControls
        lessonId={session.lesson.id}
        lessonSlug={session.lesson.slug}
        completed={session.lesson.completed}
        canComplete={Boolean(userId && session.enrolled && role !== "ADMIN")}
        previous={session.previous}
        next={session.next}
        courseSlug={session.course.slug}
        modulePosition={session.lesson.modulePosition}
        courseTitle={session.course.title}
        courseAlreadyComplete={session.course.lessonCount > 0 && session.course.percent >= 100}
      >
        {feedback}
      </LessonControls>

      {resources.length > 0 ? (
        <section className="mt-10 max-w-xl">
          <h2 className="text-sm font-medium">Lesson resources</h2>
          <ul className="mt-2">
            {resources.map((resource) => {
              const kind = resourceKind(resource.title, resource.url, resource.kind);
              const download = kind === "PDF" || kind === "ZIP" || kind === "Slides";
              return (
                <li key={resource.id} className="border-t border-border">
                  <a
                    href={resource.url}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="min-w-0 break-words">{resource.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{download ? "Download" : "Open"} · {kind}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { courseSlug, lessonSlug } = await params;
  const user = await getCurrentUser();
  const session = await getLearningSession({
    courseSlug,
    lessonSlug,
    userId: user?.id ?? null,
    role: user?.role ?? null,
  });
  if (!session) notFound();
  if (!user && !session.lesson.isPreview) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/learn/${courseSlug}/${lessonSlug}`)}`);
  }
  if (!session.canWatch) {
    redirect(`/courses/${session.course.slug}?access=denied`);
  }

  const column = <LessonColumn session={session} userId={user?.id ?? null} role={user?.role ?? null} />;
  if (user && (session.enrolled || user.role === "ADMIN")) return column;

  return (
    <LearnShell
      courseTitle={session.course.title}
      courseSlug={session.course.slug}
      percent={session.course.percent}
      completedLessons={session.course.completedLessons}
      lessonCount={session.course.lessonCount}
      modules={session.modules}
    >
      {column}
    </LearnShell>
  );
}
