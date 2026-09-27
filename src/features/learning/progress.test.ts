import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickContinueLesson } from "@/features/enrollment/continue";
import {
  VIDEO_COMPLETION_THRESHOLD,
  acceptPlaybackWrite,
  canAccessLesson,
  clampPlayback,
  courseProgress,
  creditWatchTime,
  lessonNeighbors,
  moduleProgress,
  shouldAutoComplete,
} from "@/features/learning/progress";

const lessons = [
  { id: "a", slug: "one", title: "One", position: 1, moduleTitle: "Module 1", modulePosition: 1 },
  { id: "b", slug: "two", title: "Two", position: 2, moduleTitle: "Module 1", modulePosition: 1 },
  { id: "c", slug: "three", title: "Three", position: 1, moduleTitle: "Module 2", modulePosition: 2 },
];

describe("course and module progress", () => {
  it("derives a course percent from completed lessons", () => {
    const progress = courseProgress([
      { completed: true },
      { completed: true },
      { completed: false },
      { completed: false },
    ]);
    assert.deepEqual(progress, { completed: 2, total: 4, percent: 50 });
  });

  it("treats an empty module as zero rather than complete", () => {
    assert.deepEqual(moduleProgress([]), { completed: 0, total: 0, percent: 0 });
  });

  it("marks a module complete only when every lesson is complete", () => {
    const partial = moduleProgress([{ completed: true }, { completed: false }]);
    const done = moduleProgress([{ completed: true }, { completed: true }]);
    assert.equal(partial.total > 0 && partial.completed >= partial.total, false);
    assert.equal(done.total > 0 && done.completed >= done.total, true);
  });
});

describe("lesson order", () => {
  it("steps from the last lesson of a module into the next module", () => {
    const neighbors = lessonNeighbors(lessons, "two");
    assert.equal(neighbors.previous?.slug, "one");
    assert.equal(neighbors.next?.slug, "three");
    assert.equal(neighbors.next?.modulePosition, 2);
  });

  it("has no previous lesson at the start and no next lesson at the end", () => {
    assert.equal(lessonNeighbors(lessons, "one").previous, null);
    assert.equal(lessonNeighbors(lessons, "three").next, null);
  });
});

describe("continue learning", () => {
  it("prefers the most recently watched incomplete lesson", () => {
    const next = pickContinueLesson(lessons, [
      { lessonId: "a", completed: false, lastWatchedAt: new Date("2026-09-26T10:00:00Z") },
      { lessonId: "b", completed: false, lastWatchedAt: new Date("2026-09-26T12:00:00Z") },
    ]);
    assert.equal(next?.slug, "two");
  });

  it("falls through to the first incomplete lesson", () => {
    const next = pickContinueLesson(lessons, [
      { lessonId: "a", completed: true, lastWatchedAt: new Date("2026-09-26T12:00:00Z") },
    ]);
    assert.equal(next?.slug, "two");
  });

  it("starts at the first lesson when nothing has been watched", () => {
    assert.equal(pickContinueLesson(lessons, [])?.slug, "one");
  });

  it("returns the first lesson for review when every lesson is complete", () => {
    const next = pickContinueLesson(
      lessons,
      lessons.map((lesson) => ({ lessonId: lesson.id, completed: true, lastWatchedAt: new Date() })),
    );
    assert.equal(next?.slug, "one");
  });
});

describe("playback integrity", () => {
  it("uses the configured completion threshold on watched time", () => {
    assert.equal(VIDEO_COMPLETION_THRESHOLD, 0.9);
    assert.equal(shouldAutoComplete(89, 100), false);
    assert.equal(shouldAutoComplete(90, 100), true);
    assert.equal(shouldAutoComplete(10, 0), false);
  });

  it("does not treat a seek to the end as watching the lesson", () => {
    const sample = creditWatchTime({
      storedWatched: 10,
      storedPosition: 10,
      incomingPosition: 2700,
      playedSeconds: 2,
      wallSeconds: 15,
      durationSeconds: 3000,
      reset: false,
      alreadyCompleted: false,
    });
    assert.equal(sample.lastPosition, 2700);
    assert.equal(sample.watchedSeconds, 12);
    assert.equal(sample.completed, false);
  });

  it("credits continuous playback and completes from watched time", () => {
    const sample = creditWatchTime({
      storedWatched: 80,
      storedPosition: 80,
      incomingPosition: 95,
      playedSeconds: 15,
      wallSeconds: 15,
      durationSeconds: 100,
      reset: false,
      alreadyCompleted: false,
    });
    assert.equal(sample.watchedSeconds, 95);
    assert.equal(sample.completed, true);
  });

  it("lets an explicit start over return to the beginning without erasing watch time", () => {
    const sample = creditWatchTime({
      storedWatched: 400,
      storedPosition: 763,
      incomingPosition: 0,
      playedSeconds: 0,
      wallSeconds: 5,
      durationSeconds: 840,
      reset: true,
      alreadyCompleted: false,
    });
    assert.equal(sample.lastPosition, 0);
    assert.equal(sample.watchedSeconds, 400);
    assert.equal(sample.completed, false);
  });

  it("rejects an impossible playback position", () => {
    assert.equal(clampPlayback(-1, 600), null);
    assert.equal(clampPlayback(999999, 600), null);
    assert.equal(clampPlayback(590, 600), 590);
    assert.equal(clampPlayback(604, 600), 600);
  });

  it("keeps a newer position when an older sample arrives late", () => {
    const storedAt = Date.parse("2026-09-26T12:01:00Z");
    const olderAt = Date.parse("2026-09-26T12:00:00Z");
    assert.equal(
      acceptPlaybackWrite({
        incomingPosition: 740,
        incomingAt: olderAt,
        storedPosition: 760,
        storedAt,
      }),
      false,
    );
    assert.equal(
      acceptPlaybackWrite({
        incomingPosition: 800,
        incomingAt: olderAt,
        storedPosition: 760,
        storedAt,
      }),
      false,
    );
    assert.equal(
      acceptPlaybackWrite({
        incomingPosition: 800,
        incomingAt: storedAt + 1000,
        storedPosition: 760,
        storedAt,
      }),
      true,
    );
  });

  it("allows a newer seek backward and ignores a stale tab", () => {
    assert.equal(
      acceptPlaybackWrite({
        incomingPosition: 30,
        incomingAt: 2_000,
        storedPosition: 120,
        storedAt: 1_000,
        seek: true,
      }),
      true,
    );
    assert.equal(
      acceptPlaybackWrite({
        incomingPosition: 30,
        incomingAt: 2_000,
        storedPosition: 120,
        storedAt: 1_000,
      }),
      false,
    );
  });
});

describe("lesson access", () => {
  it("allows an admin, an enrolled student, and a published preview", () => {
    assert.equal(canAccessLesson({ role: "ADMIN", enrolled: false, isPreview: false, published: false }), true);
    assert.equal(canAccessLesson({ role: "STUDENT", enrolled: true, isPreview: false, published: true }), true);
    assert.equal(canAccessLesson({ role: null, enrolled: false, isPreview: true, published: true }), true);
  });

  it("blocks a visitor and a cancelled enrollment on a protected lesson", () => {
    assert.equal(canAccessLesson({ role: null, enrolled: false, isPreview: false, published: true }), false);
    assert.equal(canAccessLesson({ role: "STUDENT", enrolled: false, isPreview: false, published: true }), false);
  });

  it("does not treat enrollment in another course as access", () => {
    assert.equal(canAccessLesson({ role: "STUDENT", enrolled: false, isPreview: false, published: true }), false);
    assert.equal(canAccessLesson({ role: "STUDENT", enrolled: false, isPreview: true, published: true }), true);
  });
});
