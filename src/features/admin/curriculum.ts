/**
 * Archived lessons stay in the database with their progress, and leave the
 * student curriculum. Course completion is calculated from visible lessons only.
 */
export type CurriculumLesson = {
  id?: string;
  title: string;
  archivedAt?: Date | null;
  videoRef?: string | null;
  description?: string;
};

export type CurriculumModule = {
  id?: string;
  title: string;
  archivedAt?: Date | null;
  lessons: CurriculumLesson[];
};

export function visibleModules<T extends CurriculumModule>(modules: T[]) {
  return modules
    .filter((module) => !module.archivedAt)
    .map((module) => ({
      ...module,
      lessons: module.lessons.filter((lesson) => !lesson.archivedAt),
    }));
}

export type PublishIssue = {
  message: string;
  moduleTitle?: string;
  href?: string;
};

export function publishIssues(input: { courseId?: string; title: string; description: string; modules: CurriculumModule[] }) {
  const issues: PublishIssue[] = [];
  if (input.title.trim().length < 2) issues.push({ message: "Add a course title." });
  if (input.description.trim().length < 20) issues.push({ message: "Add a course description." });
  const modules = visibleModules(input.modules);
  if (modules.length === 0) issues.push({ message: "Add at least one module." });
  for (const section of modules) {
    if (section.lessons.length === 0) {
      issues.push({
        message: "This module has no lessons.",
        moduleTitle: section.title,
        href: section.id ? `#module-${section.id}` : undefined,
      });
      continue;
    }
    for (const lesson of section.lessons) {
      const hasVideo = Boolean(lesson.videoRef?.trim());
      const hasText = Boolean(lesson.description?.trim());
      if (!hasVideo && !hasText) {
        issues.push({
          message: `“${lesson.title}” has no video or description.`,
          moduleTitle: section.title,
          href: input.courseId && lesson.id ? `/admin/courses/${input.courseId}/lessons/${lesson.id}` : undefined,
        });
      }
    }
  }
  return issues;
}

export type ReadinessItem = { label: string; ok: boolean; detail?: string };

/** Archived lessons are omitted from completion. This checklist is guidance, not a score. */
export function courseReadiness(input: {
  title: string;
  description: string;
  thumbnail: string | null;
  modules: CurriculumModule[];
}) {
  const modules = visibleModules(input.modules);
  const lessons = modules.flatMap((module) => module.lessons);
  const incomplete = lessons.filter((lesson) => !lesson.videoRef?.trim() && !lesson.description?.trim());
  const items: ReadinessItem[] = [
    { label: "Basic information", ok: input.title.trim().length >= 2 && input.description.trim().length >= 20 },
    { label: "Thumbnail", ok: Boolean(input.thumbnail?.startsWith("https://")) },
    {
      label: "Curriculum",
      ok: modules.length > 0 && modules.every((module) => module.lessons.length > 0),
    },
    {
      label:
        incomplete.length === 0
          ? "Lesson content"
          : incomplete.length === 1
            ? "1 lesson incomplete"
            : `${incomplete.length} lessons incomplete`,
      ok: incomplete.length === 0,
    },
  ];
  return items;
}

/** Place a moved lesson before another id, or at the end. */
export function insertBefore(ids: string[], movingId: string, beforeId: string | null) {
  const rest = ids.filter((id) => id !== movingId);
  if (!beforeId) return [...rest, movingId];
  const index = rest.indexOf(beforeId);
  if (index < 0) return [...rest, movingId];
  rest.splice(index, 0, movingId);
  return rest;
}

/** Unpublishing removes a course from the catalog. Enrolled students keep access. */
export function canEnterCourse(input: {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  enrolled: boolean;
  isAdmin: boolean;
}) {
  if (input.isAdmin || input.enrolled) return true;
  return input.status === "PUBLISHED";
}
