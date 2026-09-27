"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDevEnrollmentEnabled } from "@/server/dev-enrollment";
import { grantEnrollment } from "@/server/enrollment";
import { logServerError } from "@/server/log";
import { requireUser } from "@/server/authz";

const courseIdSchema = z.string().trim().min(1).max(64);

export async function enrollSelf(_previous: string | null, formData: FormData) {
  const user = await requireUser();
  const parsed = courseIdSchema.safeParse(formData.get("courseId"));
  if (!parsed.success) return "Choose a course.";

  const course = await db.course.findUnique({
    where: { id: parsed.data },
    select: { id: true, slug: true, status: true, priceCents: true },
  });
  if (!course || course.status !== "PUBLISHED") return "This course isn't available right now.";

  if (course.priceCents > 0 && !isDevEnrollmentEnabled()) {
    return "Payments aren't available right now. An instructor can enroll you.";
  }

  let alreadyEnrolled = false;
  try {
    const result = await grantEnrollment({
      userId: user.id,
      courseId: course.id,
      source: course.priceCents === 0 ? "FREE" : "MANUAL",
    });
    alreadyEnrolled = result.outcome === "already_enrolled";
  } catch (error) {
    logServerError("enrollSelf", error);
    return "We couldn't enroll you. Please try again.";
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/courses/${course.slug}`);
  redirect(alreadyEnrolled ? `/courses/${course.slug}` : `/courses/${course.slug}?enrolled=1`);
}
