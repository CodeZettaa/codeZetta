import type { OrderStatus } from "@prisma/client";

const labels: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAYMENT_PENDING: "Awaiting payment",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function displayOrderStatus(order: { status: OrderStatus; expiresAt: Date }, now = new Date()) {
  const open = order.status === "PENDING" || order.status === "PAYMENT_PENDING" || order.status === "FAILED";
  if (open && order.expiresAt.getTime() <= now.getTime()) return "Expired";
  return labels[order.status];
}

export function paymentStatusLabel(status: string) {
  if (status === "SUCCEEDED") return "Succeeded";
  if (status === "PROCESSING") return "Processing";
  if (status === "FAILED") return "Failed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "REFUNDED") return "Refunded";
  return "Pending";
}
