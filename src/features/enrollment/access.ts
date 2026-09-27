import { Role } from "@prisma/client";

export type CourseCallToAction =
  | { kind: "visitor"; href: string; registerHref: string }
  | { kind: "buy"; href: string }
  | { kind: "resume"; href: string }
  | { kind: "free"; courseSlug: string }
  | { kind: "enroll"; courseId: string; paid: boolean; devEnrollment: boolean }
  | { kind: "start"; href: string }
  | { kind: "continue"; href: string }
  | { kind: "completed"; href: string }
  | { kind: "instructor"; href: string; editHref: string };

/**
 * Single place that decides the course call to action.
 * Enrollment answers access. Progress answers where to resume.
 */
export function deriveCourseCallToAction(input: {
  role: Role | null;
  enrolled: boolean;
  started: boolean;
  percent: number;
  lessonHref: string;
  loginHref: string;
  editHref: string;
  courseId: string;
  courseSlug: string;
  priceCents: number;
  devEnrollment: boolean;
  paymentsAvailable: boolean;
  pendingPayment: boolean;
  checkoutHref: string;
  registerHref: string;
}): CourseCallToAction {
  if (input.role === Role.ADMIN) {
    return { kind: "instructor", href: input.lessonHref, editHref: input.editHref };
  }
  if (!input.role) return { kind: "visitor", href: input.loginHref, registerHref: input.registerHref };
  if (!input.enrolled) {
    if (input.priceCents <= 0) return { kind: "free", courseSlug: input.courseSlug };
    if (input.paymentsAvailable && input.pendingPayment) return { kind: "resume", href: input.checkoutHref };
    if (input.paymentsAvailable) return { kind: "buy", href: input.checkoutHref };
    return {
      kind: "enroll",
      courseId: input.courseId,
      paid: true,
      devEnrollment: input.devEnrollment,
    };
  }
  if (!input.started) return { kind: "start", href: input.lessonHref };
  if (input.percent >= 100) return { kind: "completed", href: input.lessonHref };
  return { kind: "continue", href: input.lessonHref };
}
