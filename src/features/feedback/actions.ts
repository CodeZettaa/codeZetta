"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasActiveEnrollment } from "@/features/courses/queries";
import { getCurrentUser, requireAdmin } from "@/server/authz";
import { logServerError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";

const feedbackSchema = z.object({
  courseId: z.string().trim().min(1).max(64),
  lessonId: z.string().trim().min(1).max(64).optional(),
  type: z.enum(["CONTENT", "TECHNICAL_ISSUE", "SUGGESTION", "OTHER"]),
  message: z.string().trim().min(10).max(2000),
});

export async function submitFeedback(_previous: string | null, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return "Your session has expired. Sign in again to continue.";
  if (user.role === "ADMIN") return "Feedback is sent from a student account.";

  const lessonRaw = formData.get("lessonId");
  const parsed = feedbackSchema.safeParse({
    courseId: formData.get("courseId"),
    lessonId: typeof lessonRaw === "string" && lessonRaw.length > 0 ? lessonRaw : undefined,
    type: formData.get("type"),
    message: formData.get("message"),
  });
  if (!parsed.success) return "Choose a type and write at least a short note.";

  const limit = rateLimit(`feedback:${user.id}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return "You've sent several notes recently. Try again in a little while.";

  const enrolled = await hasActiveEnrollment(user.id, parsed.data.courseId);
  if (!enrolled) return "You don't have access to this course.";

  if (parsed.data.lessonId) {
    const lesson = await db.lesson.findFirst({
      where: { id: parsed.data.lessonId, courseId: parsed.data.courseId },
      select: { id: true },
    });
    if (!lesson) return "That lesson isn't part of this course.";
  }

  const routeRaw = formData.get("route");
  let message = parsed.data.message;
  if (
    parsed.data.type === "TECHNICAL_ISSUE" &&
    typeof routeRaw === "string" &&
    /^\/learn\/[a-z0-9-]+\/[a-z0-9-]+$/.test(routeRaw.trim())
  ) {
    message = `${message}\n\nRoute: ${routeRaw.trim()}`;
  }

  try {
    await db.feedback.create({
      data: {
        userId: user.id,
        courseId: parsed.data.courseId,
        lessonId: parsed.data.lessonId,
        type: parsed.data.type,
        message,
      },
    });
  } catch (error) {
    logServerError("submitFeedback", error);
    return "We couldn't send your feedback. Please try again.";
  }

  revalidatePath("/admin/feedback");
  if (formData.get("stay") === "1") return "sent";
  redirect("/dashboard/feedback?sent=1");
}

const statusSchema = z.object({
  id: z.string().trim().min(1).max(64),
  status: z.enum(["READ", "RESOLVED"]),
});

export async function setFeedbackStatus(id: string, status: "READ" | "RESOLVED", formData: FormData) {
  void formData;
  await requireAdmin();
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return;
  try {
    await db.feedback.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
  } catch (error) {
    logServerError("setFeedbackStatus", error);
    return;
  }
  revalidatePath("/admin/feedback");
}
