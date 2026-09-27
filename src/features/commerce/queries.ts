import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";

const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  currency: true,
  subtotalCents: true,
  discountCents: true,
  totalCents: true,
  couponCodeSnapshot: true,
  promotionNameSnapshot: true,
  reviewRequired: true,
  expiresAt: true,
  paidAt: true,
  cancelledAt: true,
  createdAt: true,
  items: {
    select: {
      courseId: true,
      courseTitleSnapshot: true,
      unitPriceCents: true,
      quantity: true,
      totalCents: true,
      course: { select: { slug: true } },
    },
  },
} as const;

export async function hasOpenCheckout(userId: string, courseId: string) {
  const order = await db.order.findFirst({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      status: { in: ["PENDING", "PAYMENT_PENDING", "FAILED"] },
      items: { some: { courseId } },
    },
    select: { id: true },
  });
  return Boolean(order);
}

export async function getStudentOrders(userId: string) {
  return db.order.findMany({
    where: { userId },
    select: orderListSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getStudentOrder(userId: string, orderNumber: string) {
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      ...orderListSelect,
      userId: true,
      payments: {
        select: { status: true, amountCents: true, currency: true, createdAt: true, confirmedAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order || order.userId !== userId) return null;
  return order;
}

const adminFilters = ["all", "paid", "pending", "failed", "cancelled", "refunded"] as const;
export type AdminOrderFilter = (typeof adminFilters)[number];

export function parseAdminOrderFilter(value: string | undefined): AdminOrderFilter {
  return adminFilters.find((item) => item === value) ?? "all";
}

function statusWhere(filter: AdminOrderFilter): OrderStatus | { in: OrderStatus[] } | undefined {
  if (filter === "paid") return "PAID";
  if (filter === "pending") return { in: ["PENDING", "PAYMENT_PENDING"] };
  if (filter === "failed") return "FAILED";
  if (filter === "cancelled") return "CANCELLED";
  if (filter === "refunded") return "REFUNDED";
  return undefined;
}

export async function getAdminOrders(query: string, filter: AdminOrderFilter) {
  const needle = query.trim();
  return db.order.findMany({
    where: {
      status: statusWhere(filter),
      ...(needle
        ? {
            OR: [
              { orderNumber: { contains: needle, mode: "insensitive" } },
              { user: { email: { contains: needle, mode: "insensitive" } } },
              { user: { name: { contains: needle, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      ...orderListSelect,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getAdminOrder(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    select: {
      ...orderListSelect,
      user: { select: { id: true, name: true, email: true } },
      payments: {
        select: {
          status: true,
          provider: true,
          providerPaymentId: true,
          providerTransactionId: true,
          amountCents: true,
          currency: true,
          createdAt: true,
          confirmedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function enrollmentForOrderItem(userId: string, courseId: string) {
  return db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true, source: true },
  });
}
