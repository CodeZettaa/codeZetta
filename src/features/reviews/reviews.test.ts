import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canWriteReview,
  isPublicReview,
  plainReviewText,
  publicReviewName,
  ratingSummary,
  validRating,
} from "@/features/reviews/eligibility";

describe("review eligibility", () => {
  it("requires an active enrollment and meaningful progress", () => {
    assert.equal(canWriteReview({ enrollmentStatus: null, completedLessons: 5, lessonCount: 10 }), false);
    assert.equal(canWriteReview({ enrollmentStatus: "CANCELLED", completedLessons: 5, lessonCount: 10 }), false);
    assert.equal(canWriteReview({ enrollmentStatus: "ACTIVE", completedLessons: 1, lessonCount: 10 }), false);
    assert.equal(canWriteReview({ enrollmentStatus: "ACTIVE", completedLessons: 2, lessonCount: 10 }), true);
    assert.equal(canWriteReview({ enrollmentStatus: "COMPLETED", completedLessons: 10, lessonCount: 10 }), true);
  });

  it("accepts only ratings from 1 to 5", () => {
    assert.equal(validRating(0), false);
    assert.equal(validRating(6), false);
    assert.equal(validRating(1.5), false);
    assert.equal(validRating(5), true);
  });

  it("excludes hidden and removed reviews from the public aggregate", () => {
    assert.equal(isPublicReview({ status: "PUBLISHED", removedAt: null }), true);
    assert.equal(isPublicReview({ status: "HIDDEN", removedAt: null }), false);
    assert.equal(isPublicReview({ status: "FLAGGED", removedAt: null }), false);
    assert.equal(isPublicReview({ status: "PUBLISHED", removedAt: new Date() }), false);
    const summary = ratingSummary({ 5: 4, 4: 1 });
    assert.equal(summary.count, 5);
    assert.equal(summary.average, 4.8);
  });

  it("strips markup and hides email addresses", () => {
    assert.equal(plainReviewText('<script>alert(1)</script> Clear explanation'), "alert(1) Clear explanation");
    assert.equal(publicReviewName("student@example.com"), "Learner");
    assert.equal(publicReviewName("Ahmed Hassan"), "Ahmed");
  });
});
