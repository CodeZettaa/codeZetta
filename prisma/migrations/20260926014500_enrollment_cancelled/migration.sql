-- Rename the cancelled enrollment state and record when a course is finished.
ALTER TYPE "EnrollmentStatus" RENAME VALUE 'REVOKED' TO 'CANCELLED';

ALTER TABLE "Enrollment" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Enrollment" SET "createdAt" = "enrolledAt";
