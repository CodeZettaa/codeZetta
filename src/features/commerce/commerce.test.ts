import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineTotal, orderTotal, quoteCourse } from "@/features/commerce/money";
import { isMockProviderEnabled, parseMockEvent, signMockBody } from "@/features/commerce/provider";
import {
  canEnrollFree,
  canReuseOpenOrder,
  canTransitionOrder,
  canTransitionPayment,
  canViewOrder,
  decidePaymentEvent,
  purchaseBlocked,
} from "@/features/commerce/state";

const secret = "test-webhook-secret";

function eventBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_success_001",
    type: "payment.succeeded",
    paymentAttemptId: "attempt_12345678",
    amount: 200000,
    currency: "EGP",
    providerPaymentId: "mock_attempt_12345678",
    ...overrides,
  });
}

const baseDecision = {
  alreadyProcessed: false,
  attemptFound: true,
  orderStatus: "PAYMENT_PENDING" as const,
  attemptStatus: "PROCESSING" as const,
  attemptId: "attempt_12345678",
  payingAttemptId: null,
  eventType: "payment.succeeded" as const,
  eventAmountCents: 200000,
  orderTotalCents: 200000,
  eventCurrency: "EGP",
  orderCurrency: "EGP",
};

describe("money", () => {
  it("quotes a course in integer minor units and ignores later price changes", () => {
    const quote = quoteCourse({ title: "Angular Signals", priceCents: 200000, currency: "EGP" });
    assert.equal(quote.courseTitleSnapshot, "Angular Signals");
    assert.equal(quote.unitPriceCents, 200000);
    assert.equal(quote.subtotalCents, 200000);
    assert.equal(quote.discountCents, 0);
    assert.equal(quote.totalCents, 200000);
    assert.equal(quote.currency, "EGP");
    const later = quoteCourse({ title: "Angular Signals", priceCents: 250000, currency: "EGP" });
    assert.notEqual(later.totalCents, quote.totalCents);
    assert.equal(quote.totalCents, 200000);
  });

  it("rejects unsafe quantities and discounts", () => {
    assert.equal(lineTotal(200000, 2), 400000);
    assert.equal(orderTotal(200000, 0), 200000);
    assert.throws(() => lineTotal(10.5, 1));
    assert.throws(() => orderTotal(100, 101));
  });
});

describe("orders", () => {
  it("reuses a matching open order and refuses a changed price or an expired order", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const quote = { totalCents: 200000, discountCents: 0, currency: "EGP" };
    const open = {
      status: "PENDING" as const,
      expiresAt: new Date("2026-09-27T12:00:00Z"),
      totalCents: 200000,
      discountCents: 0,
      currency: "EGP",
    };
    assert.equal(canReuseOpenOrder(open, quote, now), true);
    assert.equal(canReuseOpenOrder({ ...open, totalCents: 250000 }, quote, now), false);
    assert.equal(canReuseOpenOrder({ ...open, expiresAt: new Date("2026-09-26T11:00:00Z") }, quote, now), false);
    assert.equal(canReuseOpenOrder({ ...open, status: "PAID" }, quote, now), false);
  });

  it("blocks a second purchase and allows a free enrollment only when the course is published at zero", () => {
    assert.equal(purchaseBlocked("ACTIVE"), true);
    assert.equal(purchaseBlocked("COMPLETED"), true);
    assert.equal(purchaseBlocked("CANCELLED"), false);
    assert.equal(purchaseBlocked(null), false);
    assert.equal(canEnrollFree({ status: "PUBLISHED", priceCents: 0 }), true);
    assert.equal(canEnrollFree({ status: "PUBLISHED", priceCents: 100 }), false);
    assert.equal(canEnrollFree({ status: "DRAFT", priceCents: 0 }), false);
  });

  it("limits an order to its owner", () => {
    assert.equal(canViewOrder("student-a", "student-a"), true);
    assert.equal(canViewOrder("student-a", "student-b"), false);
  });
});

describe("payment state", () => {
  it("refuses paid and refunded orders moving backwards", () => {
    assert.equal(canTransitionOrder("PAID", "PENDING"), false);
    assert.equal(canTransitionOrder("PAID", "FAILED"), false);
    assert.equal(canTransitionOrder("REFUNDED", "PAID"), false);
    assert.equal(canTransitionOrder("FAILED", "PAID"), true);
    assert.equal(canTransitionPayment("SUCCEEDED", "FAILED"), false);
    assert.equal(canTransitionPayment("FAILED", "SUCCEEDED"), true);
  });

  it("pays once from a verified success and ignores a later failure", () => {
    assert.deepEqual(decidePaymentEvent(baseDecision), { action: "succeed" });
    assert.deepEqual(
      decidePaymentEvent({ ...baseDecision, orderStatus: "PAID", eventType: "payment.failed" }),
      { action: "ignore", reason: "paid" },
    );
    assert.deepEqual(
      decidePaymentEvent({ ...baseDecision, orderStatus: "FAILED", attemptStatus: "FAILED" }),
      { action: "succeed" },
    );
  });

  it("flags a second successful attempt and does not treat it as a new enrollment", () => {
    assert.deepEqual(
      decidePaymentEvent({
        ...baseDecision,
        orderStatus: "PAID",
        attemptId: "attempt_other",
        payingAttemptId: "attempt_12345678",
      }),
      { action: "flag_review" },
    );
  });

  it("rejects the same event, a bad amount, a bad currency, and an unknown attempt", () => {
    assert.deepEqual(decidePaymentEvent({ ...baseDecision, alreadyProcessed: true }), { action: "duplicate" });
    for (let time = 0; time < 5; time += 1) {
      assert.equal(decidePaymentEvent({ ...baseDecision, alreadyProcessed: true }).action, "duplicate");
    }
    assert.deepEqual(decidePaymentEvent({ ...baseDecision, eventAmountCents: 1 }), { action: "reject", reason: "amount" });
    assert.deepEqual(decidePaymentEvent({ ...baseDecision, eventCurrency: "USD" }), { action: "reject", reason: "currency" });
    assert.deepEqual(decidePaymentEvent({ ...baseDecision, attemptFound: false }), { action: "unknown" });
  });

  it("records failure and cancellation without paying", () => {
    assert.deepEqual(
      decidePaymentEvent({ ...baseDecision, eventType: "payment.failed" }),
      { action: "fail" },
    );
    assert.deepEqual(
      decidePaymentEvent({ ...baseDecision, eventType: "payment.cancelled" }),
      { action: "cancel" },
    );
  });
});

describe("mock provider guard", () => {
  it("stays disabled in production even when the mock variables are set", () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = {
      nodeEnv: env.NODE_ENV,
      provider: env.PAYMENT_PROVIDER,
      secret: env.PAYMENT_WEBHOOK_SECRET,
    };
    env.NODE_ENV = "production";
    env.PAYMENT_PROVIDER = "mock";
    env.PAYMENT_WEBHOOK_SECRET = "0123456789abcdef";
    try {
      assert.equal(isMockProviderEnabled(), false);
    } finally {
      env.NODE_ENV = previous.nodeEnv;
      env.PAYMENT_PROVIDER = previous.provider;
      env.PAYMENT_WEBHOOK_SECRET = previous.secret;
    }
  });
});

describe("mock webhook", () => {
  it("accepts a signed body and rejects a bad signature, a tampered amount, and junk", () => {
    const body = eventBody();
    const signature = signMockBody(body, secret);
    const verified = parseMockEvent(body, signature, secret);
    assert.equal(verified?.amountCents, 200000);
    assert.equal(verified?.type, "payment.succeeded");
    assert.equal(parseMockEvent(body, "deadbeef", secret), null);
    assert.equal(parseMockEvent(body, null, secret), null);
    assert.equal(parseMockEvent(eventBody({ amount: 1 }), signature, secret), null);
    assert.equal(parseMockEvent("{", signature, secret), null);
  });
});
