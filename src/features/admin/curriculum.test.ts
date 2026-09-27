import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEnterCourse, courseReadiness, insertBefore, publishIssues, visibleModules } from "@/features/admin/curriculum";

describe("archived curriculum", () => {
  it("hides archived modules and lessons from the student curriculum", () => {
    const visible = visibleModules([
      {
        title: "One",
        lessons: [
          { title: "Keep" },
          { title: "Gone", archivedAt: new Date() },
        ],
      },
      { title: "Retired", archivedAt: new Date(), lessons: [{ title: "Old" }] },
    ]);
    assert.deepEqual(
      visible.map((module) => ({ title: module.title, lessons: module.lessons.map((lesson) => lesson.title) })),
      [{ title: "One", lessons: ["Keep"] }],
    );
  });
});

describe("publish readiness", () => {
  it("lists the modules and lessons that still need content", () => {
    const issues = publishIssues({
      title: "Angular Signals",
      description: "A course about signals in Angular.",
      modules: [
        { title: "Computed", lessons: [] },
        { title: "Effects", lessons: [{ title: "Memoization", description: "", videoRef: "" }] },
      ],
    });
    assert.equal(issues.some((issue) => issue.moduleTitle === "Computed"), true);
    assert.equal(issues.some((issue) => issue.message.includes("Memoization")), true);
  });

  it("accepts a course whose lessons have a description or a video", () => {
    const issues = publishIssues({
      title: "Angular Signals",
      description: "A course about signals in Angular.",
      modules: [{ title: "Signals", lessons: [{ title: "signal()", description: "How signal() works." }] }],
    });
    assert.deepEqual(issues, []);
  });
});

describe("course readiness", () => {
  it("flags incomplete lessons without turning the list into a score", () => {
    const items = courseReadiness({
      title: "Angular Signals",
      description: "A course about signals in Angular.",
      thumbnail: null,
      modules: [{ title: "Computed", lessons: [{ title: "Memoization", description: "", videoRef: "" }] }],
    });
    assert.equal(items.find((item) => item.label === "Thumbnail")?.ok, false);
    assert.equal(items.some((item) => item.label === "1 lesson incomplete" && !item.ok), true);
  });
});

describe("lesson moves", () => {
  it("inserts a lesson before the drop target and leaves the other ids in order", () => {
    assert.deepEqual(insertBefore(["a", "b", "c"], "a", "c"), ["b", "a", "c"]);
    assert.deepEqual(insertBefore(["a", "b"], "a", null), ["b", "a"]);
  });
});

describe("unpublished course access", () => {
  it("keeps enrolled students in a course that left the catalog", () => {
    assert.equal(canEnterCourse({ status: "DRAFT", enrolled: true, isAdmin: false }), true);
    assert.equal(canEnterCourse({ status: "DRAFT", enrolled: false, isAdmin: false }), false);
    assert.equal(canEnterCourse({ status: "PUBLISHED", enrolled: false, isAdmin: false }), true);
  });
});
