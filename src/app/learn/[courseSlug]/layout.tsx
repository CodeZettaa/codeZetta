import type { ReactNode } from "react";
import { LearnShell } from "@/features/learning/components/learn-shell";
import { getLearnCourseFrame } from "@/features/learning/queries";
import { getCurrentUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export default async function LearnCourseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const user = await getCurrentUser();
  const frame = await getLearnCourseFrame({
    courseSlug,
    userId: user?.id ?? null,
    role: user?.role ?? null,
  });
  if (!frame || !user || !(frame.enrolled || user.role === "ADMIN")) return children;

  return (
    <LearnShell
      courseTitle={frame.course.title}
      courseSlug={frame.course.slug}
      percent={frame.course.percent}
      completedLessons={frame.course.completedLessons}
      lessonCount={frame.course.lessonCount}
      modules={frame.modules}
    >
      {children}
    </LearnShell>
  );
}
