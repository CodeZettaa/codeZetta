export type LearningEvent =
  | { type: "course_started"; userId: string; courseId: string }
  | { type: "lesson_started"; userId: string; courseId: string; lessonId: string }
  | { type: "lesson_completed"; userId: string; courseId: string; lessonId: string }
  | { type: "course_completed"; userId: string; courseId: string };

/**
 * Stable call sites for a future analytics store.
 * Nothing is persisted in this phase.
 */
export function recordLearningEvent(event: LearningEvent) {
  if (process.env.LEARNING_EVENTS === "log") {
    console.info("[learning]", event.type);
  }
}
