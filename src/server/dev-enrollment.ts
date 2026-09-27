/**
 * Self-enrollment for local testing of paid courses.
 * Ignored unless both conditions hold, so a production deploy cannot turn it on
 * by copying an env flag alone.
 */
export function isDevEnrollmentEnabled() {
  return process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_ENROLLMENT === "true";
}
