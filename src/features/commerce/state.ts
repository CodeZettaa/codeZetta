import type { OrderStatus, PaymentStatus } from "@prisma/client";

const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAYMENT_PENDING", "FAILED", "CANCELLED"],
  PAYMENT_PENDING: ["PENDING", "PAID", "FAILED", "CANCELLED"],
  FAILED: ["PAYMENT_PENDING", "CANCELLED", "PAID"],
  CANCELLED: ["PAYMENT_PENDING", "PAID"],
  PAID: ["REFUNDED"],
  REFUNDED: [],
};

const paymentTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: ["REFUNDED"],
  FAILED: ["SUCCEEDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return from === to || orderTransitions[from].includes(to);
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return from === to || paymentTransitions[from].includes(to);
}

export type PaymentEventType = "payment.succeeded" | "payment.failed" | "payment.cancelled";

export type PaymentDecision =
  | { action: "duplicate" }
  | { action: "unknown" }
  | { action: "reject"; reason: "amount" | "currency" }
  | { action: "ignore"; reason: "already_settled" | "paid" }
  | { action: "flag_review" }
  | { action: "succeed" }
  | { action: "fail" }
  | { action: "cancel" };

/**
 * Pure payment decision. The database transaction applies this and nothing else.
 * A browser return URL never reaches this function.
 */
export function decidePaymentEvent(input: {
  alreadyProcessed: boolean;
  attemptFound: boolean;
  orderStatus: OrderStatus;
  attemptStatus: PaymentStatus;
  attemptId: string;
  payingAttemptId: string | null;
  eventType: PaymentEventType;
  eventAmountCents: number;
  orderTotalCents: number;
  eventCurrency: string;
  orderCurrency: string;
}): PaymentDecision {
  if (input.alreadyProcessed) return { action: "duplicate" };
  if (!input.attemptFound) return { action: "unknown" };
  if (input.eventAmountCents !== input.orderTotalCents) return { action: "reject", reason: "amount" };
  if (input.eventCurrency !== input.orderCurrency) return { action: "reject", reason: "currency" };

  if (input.eventType === "payment.succeeded") {
    if (input.attemptStatus === "SUCCEEDED") return { action: "ignore", reason: "already_settled" };
    if (input.orderStatus === "REFUNDED") return { action: "flag_review" };
    if (input.orderStatus === "PAID" && input.payingAttemptId !== input.attemptId) {
      return { action: "flag_review" };
    }
    if (input.orderStatus === "PAID") return { action: "ignore", reason: "paid" };
    return { action: "succeed" };
  }

  if (input.orderStatus === "PAID" || input.orderStatus === "REFUNDED" || input.attemptStatus === "SUCCEEDED") {
    return { action: "ignore", reason: "paid" };
  }

  if (input.eventType === "payment.failed") return { action: "fail" };
  return { action: "cancel" };
}

export function purchaseBlocked(status: "ACTIVE" | "COMPLETED" | "CANCELLED" | null) {
  return status === "ACTIVE" || status === "COMPLETED";
}

export function canEnrollFree(course: { status: string; priceCents: number }) {
  return course.status === "PUBLISHED" && course.priceCents === 0;
}

export function canViewOrder(orderUserId: string, viewerId: string) {
  return orderUserId === viewerId;
}

const OPEN_STATUSES: readonly OrderStatus[] = ["PENDING", "PAYMENT_PENDING", "FAILED"];

export function canReuseOpenOrder(
  order: {
    status: OrderStatus;
    expiresAt: Date;
    totalCents: number;
    discountCents: number;
    currency: string;
    couponCodeSnapshot?: string | null;
    promotionNameSnapshot?: string | null;
  },
  quote: {
    totalCents: number;
    discountCents: number;
    currency: string;
    couponCode?: string | null;
    promotionName?: string | null;
  },
  now: Date,
) {
  if (!OPEN_STATUSES.includes(order.status)) return false;
  if (order.expiresAt.getTime() <= now.getTime()) return false;
  return (
    order.totalCents === quote.totalCents &&
    order.discountCents === quote.discountCents &&
    order.currency === quote.currency &&
    (order.couponCodeSnapshot ?? null) === (quote.couponCode ?? null) &&
    (order.promotionNameSnapshot ?? null) === (quote.promotionName ?? null)
  );
}

export const ORDER_TTL_MS = 24 * 60 * 60 * 1000;
export const ATTEMPT_REUSE_MS = 20_000;
