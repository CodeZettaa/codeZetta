import { db } from "@/lib/db";
import { requireAdmin } from "@/server/authz";

export async function getFeedbackCourses(userId: string) {
  return db.enrollment.findMany({
    where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { enrolledAt: "desc" },
    select: {
      course: {
        select: {
          id: true,
          title: true,
          lessons: {
            where: { archivedAt: null, module: { archivedAt: null } },
            orderBy: [{ module: { position: "asc" } }, { position: "asc" }],
            select: { id: true, title: true },
          },
        },
      },
    },
  });
}

export async function getAdminFeedback() {
  await requireAdmin();
  return db.feedback.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      type: true,
      message: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      course: { select: { id: true, title: true } },
      lesson: { select: { id: true, title: true } },
    },
  });
}
