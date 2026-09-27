/** Fraction of watched time that counts as complete. Not copied into callers. */
export const VIDEO_COMPLETION_THRESHOLD = 0.9;

/** Reject absurd browser values. A lesson is not twelve hours by accident. */
export const MAX_PLAYBACK_SECONDS = 12 * 60 * 60;

/** One progress write can credit at most a little more than the save interval. */
export const MAX_WATCH_CREDIT_SECONDS = 20;

/** A playhead jump beyond played time plus this grace is a seek, not watching. */
export const SEEK_GRACE_SECONDS = 3;

/** Resume quietly. A few seconds is not worth moving the playhead. */
export const RESUME_SEEK_SECONDS = 5;

/** Show the resumed-at note, and allow an explicit start over, past this point. */
export const RESUME_NOTICE_SECONDS = 30;

export function completionPercent(completed: number, total: number) {
  if (total <= 0 || completed <= 0) return 0;
  return Math.round((Math.min(completed, total) / total) * 100);
}

export function courseProgress(lessons: { completed: boolean }[]) {
  const completed = lessons.filter((lesson) => lesson.completed).length;
  return {
    completed,
    total: lessons.length,
    percent: completionPercent(completed, lessons.length),
  };
}

export function moduleProgress(lessons: { completed: boolean }[]) {
  return courseProgress(lessons);
}

export function shouldAutoComplete(watchedSeconds: number, durationSeconds: number) {
  if (durationSeconds <= 0 || watchedSeconds <= 0) return false;
  return watchedSeconds / durationSeconds >= VIDEO_COMPLETION_THRESHOLD;
}

/**
 * Seconds that count as watching.
 * A jump from 0:10 to 45:00 credits only the time the player was actually playing.
 */
export function watchedIncrement(input: { fromPosition: number; toPosition: number; playedSeconds: number }) {
  const played = Number.isFinite(input.playedSeconds) ? Math.max(0, input.playedSeconds) : 0;
  const jump = input.toPosition - input.fromPosition;
  if (!(jump > 0)) return 0;
  const playedCredit = Math.floor(Math.min(played, MAX_WATCH_CREDIT_SECONDS));
  if (jump > played + SEEK_GRACE_SECONDS) return playedCredit;
  return Math.min(Math.floor(jump), playedCredit);
}

export function creditWatchTime(input: {
  storedWatched: number;
  storedPosition: number | null;
  incomingPosition: number;
  playedSeconds: number;
  wallSeconds: number;
  durationSeconds: number;
  reset: boolean;
  alreadyCompleted: boolean;
}) {
  if (input.reset) {
    return {
      lastPosition: 0,
      watchedSeconds: Math.max(0, input.storedWatched),
      completed: input.alreadyCompleted,
    };
  }
  const wall = Number.isFinite(input.wallSeconds) ? Math.max(0, input.wallSeconds) : 0;
  const played = Math.min(Math.max(0, input.playedSeconds), wall, MAX_WATCH_CREDIT_SECONDS);
  const delta = watchedIncrement({
    fromPosition: input.storedPosition ?? 0,
    toPosition: input.incomingPosition,
    playedSeconds: played,
  });
  const cap = input.durationSeconds > 0 ? input.durationSeconds : MAX_PLAYBACK_SECONDS;
  const watchedSeconds = Math.min(cap, Math.max(0, input.storedWatched) + delta);
  return {
    lastPosition: input.incomingPosition,
    watchedSeconds,
    completed: input.alreadyCompleted || shouldAutoComplete(watchedSeconds, input.durationSeconds),
  };
}

/**
 * Returns a safe playback position, or null when the browser value is not usable.
 * A few seconds past the duration is the end of the video. Far past it is rejected.
 */
export function clampPlayback(positionSeconds: number, durationSeconds: number) {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return null;
  const value = Math.floor(positionSeconds);
  if (value > MAX_PLAYBACK_SECONDS) return null;
  if (durationSeconds > 0 && value > durationSeconds + 5) return null;
  if (durationSeconds > 0) return Math.min(value, durationSeconds);
  return value;
}

export type SequenceLesson = {
  slug: string;
  title: string;
  position: number;
  moduleTitle: string;
  modulePosition: number;
};

export function orderLessons<T extends Pick<SequenceLesson, "modulePosition" | "position">>(lessons: T[]) {
  return [...lessons].sort((a, b) => a.modulePosition - b.modulePosition || a.position - b.position);
}

export function lessonNeighbors<T extends SequenceLesson>(lessons: T[], slug: string) {
  const ordered = orderLessons(lessons);
  const index = ordered.findIndex((lesson) => lesson.slug === slug);
  if (index < 0) return { previous: null, next: null };
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index < ordered.length - 1 ? ordered[index + 1] : null;
  const toRef = (lesson: T | null) =>
    lesson
      ? {
          slug: lesson.slug,
          title: lesson.title,
          moduleTitle: lesson.moduleTitle,
          modulePosition: lesson.modulePosition,
        }
      : null;
  return { previous: toRef(previous), next: toRef(next) };
}

export function canAccessLesson(input: {
  role: "ADMIN" | "STUDENT" | null;
  enrolled: boolean;
  isPreview: boolean;
  published: boolean;
}) {
  if (input.role === "ADMIN") return true;
  if (input.enrolled) return true;
  return input.published && input.isPreview;
}

/**
 * A late sample must not rewind a newer position, even if its playhead is further ahead.
 * A newer sample may move backward only when the student seeks or starts over.
 */
export function acceptPlaybackWrite(input: {
  incomingPosition: number;
  incomingAt: number;
  storedPosition: number | null;
  storedAt: number | null;
  seek?: boolean;
}) {
  if (input.storedAt == null || input.storedPosition == null) return true;
  if (input.incomingAt < input.storedAt) return false;
  const behind = input.incomingPosition + 2 < input.storedPosition;
  if (behind && !input.seek) return false;
  return true;
}
