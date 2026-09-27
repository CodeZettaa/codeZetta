import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentEventType } from "@/features/commerce/state";

export type VerifiedPaymentEvent = {
  provider: "mock";
  eventId: string;
  type: PaymentEventType;
  paymentAttemptId: string;
  amountCents: number;
  currency: string;
  providerPaymentId: string;
};

export type CreatedPayment = {
  providerPaymentId: string;
  redirectUrl: string;
};

export interface PaymentProvider {
  readonly name: "mock";
  createPayment(input: {
    attemptId: string;
    orderNumber: string;
    amountCents: number;
    currency: string;
  }): Promise<CreatedPayment>;
  verifyWebhook(rawBody: string, signature: string | null): VerifiedPaymentEvent | null;
  getPaymentStatus(providerPaymentId: string): Promise<"PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN">;
  refundPayment(providerPaymentId: string): Promise<{ supported: false }>;
}

export const MOCK_SIGNATURE_HEADER = "x-codezetta-signature";

export function isMockProviderEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.PAYMENT_PROVIDER === "mock" &&
    typeof process.env.PAYMENT_WEBHOOK_SECRET === "string" &&
    process.env.PAYMENT_WEBHOOK_SECRET.length >= 16
  );
}

export function signMockBody(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyMockSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = signMockBody(rawBody, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const eventTypes = new Set<PaymentEventType>(["payment.succeeded", "payment.failed", "payment.cancelled"]);

export function parseMockEvent(rawBody: string, signature: string | null, secret: string): VerifiedPaymentEvent | null {
  if (!verifyMockSignature(rawBody, signature, secret)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  if (typeof body.id !== "string" || body.id.length < 8 || body.id.length > 120) return null;
  if (typeof body.type !== "string" || !eventTypes.has(body.type as PaymentEventType)) return null;
  if (typeof body.paymentAttemptId !== "string" || body.paymentAttemptId.length < 8) return null;
  if (typeof body.providerPaymentId !== "string" || body.providerPaymentId.length < 4) return null;
  if (typeof body.currency !== "string" || body.currency.length < 3 || body.currency.length > 8) return null;
  if (!Number.isSafeInteger(body.amount) || (body.amount as number) < 0) return null;
  return {
    provider: "mock",
    eventId: body.id,
    type: body.type as PaymentEventType,
    paymentAttemptId: body.paymentAttemptId,
    amountCents: body.amount as number,
    currency: body.currency,
    providerPaymentId: body.providerPaymentId,
  };
}
