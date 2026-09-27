import { db } from "@/lib/db";
import { isMockProviderEnabled, parseMockEvent, type PaymentProvider } from "@/features/commerce/provider";

/**
 * Development-only provider. It never charges a card.
 * A simulated outcome still has to pass the same signed webhook path as a real provider.
 * NODE_ENV must be development. PAYMENT_PROVIDER=mock is ignored in production.
 */
export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  async createPayment(input) {
    return {
      providerPaymentId: `mock_${input.attemptId}`,
      redirectUrl: `/checkout/mock/${input.attemptId}`,
    };
  },
  verifyWebhook(rawBody, signature) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!isMockProviderEnabled() || !secret) return null;
    return parseMockEvent(rawBody, signature, secret);
  },
  async getPaymentStatus(providerPaymentId) {
    const attempt = await db.paymentAttempt.findFirst({
      where: { provider: "mock", providerPaymentId },
      select: { status: true },
    });
    if (!attempt) return "UNKNOWN";
    if (attempt.status === "SUCCEEDED" || attempt.status === "FAILED" || attempt.status === "CANCELLED") {
      return attempt.status;
    }
    return "PENDING";
  },
  async refundPayment() {
    return { supported: false };
  },
};

export function activePaymentProvider(): PaymentProvider | null {
  if (!isMockProviderEnabled()) return null;
  return mockPaymentProvider;
}
