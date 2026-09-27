import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePrice,
  couponMessages,
  discountAmount,
  normalizeCouponCode,
  reservationAllowed,
  type CouponInput,
  type PromotionInput,
} from "@/features/commerce/pricing";

const now = new Date("2026-09-26T12:00:00Z");

function coupon(overrides: Partial<CouponInput> = {}): CouponInput {
  return {
    id: "coupon-1",
    code: "SIGNALS20",
    status: "ACTIVE",
    discountType: "PERCENTAGE",
    discountValue: 20,
    currency: null,
    startsAt: null,
    expiresAt: new Date("2026-10-15T00:00:00Z"),
    applies: true,
    minimumOrderCents: 0,
    maxRedemptions: 100,
    redemptionCount: 0,
    maxRedemptionsPerUser: 1,
    userRedemptionCount: 0,
    ...overrides,
  };
}

function promotion(overrides: Partial<PromotionInput> = {}): PromotionInput {
  return {
    id: "promo-1",
    name: "Angular Signals Launch Offer",
    status: "ACTIVE",
    discountType: "PERCENTAGE",
    discountValue: 50,
    currency: null,
    startsAt: new Date("2026-09-26T00:00:00Z"),
    endsAt: new Date("2026-10-10T00:00:00Z"),
    applies: true,
    ...overrides,
  };
}

function price(overrides: Parameters<typeof calculatePrice>[0] = { title: "Angular Signals", priceCents: 200000, currency: "EGP", now, promotions: [], coupon: null }) {
  return calculatePrice(overrides);
}

describe("coupon codes", () => {
  it("treats letter case as the same code", () => {
    assert.equal(normalizeCouponCode("signals20"), "SIGNALS20");
    assert.equal(normalizeCouponCode("  Signals20 "), "SIGNALS20");
    assert.equal(normalizeCouponCode("no"), null);
  });
});

describe("pricing engine", () => {
  it("applies a percentage coupon with integer minor units", () => {
    const quote = price({ title: "Angular Signals", priceCents: 200000, currency: "EGP", now, promotions: [], coupon: coupon() });
    assert.equal(quote.discountCents, 40000);
    assert.equal(quote.totalCents, 160000);
    assert.equal(quote.couponCode, "SIGNALS20");
    assert.equal(quote.totalCents, quote.subtotalCents - quote.discountCents);
  });

  it("caps a fixed discount at the course price", () => {
    const quote = price({
      title: "Angular Signals",
      priceCents: 20000,
      currency: "EGP",
      now,
      promotions: [],
      coupon: coupon({ discountType: "FIXED_AMOUNT", discountValue: 50000, currency: "EGP" }),
    });
    assert.equal(quote.discountCents, 20000);
    assert.equal(quote.totalCents, 0);
    assert.equal(discountAmount(200000, "FIXED_AMOUNT", 50000), 50000);
  });

  it("rejects expired, future, disabled, wrong-course, minimum, and limit cases", () => {
    const base = { title: "Angular Signals", priceCents: 200000, currency: "EGP", now, promotions: [] as PromotionInput[] };
    assert.equal(price({ ...base, coupon: coupon({ expiresAt: new Date("2026-09-01T00:00:00Z") }) }).couponError, couponMessages.expired);
    assert.equal(price({ ...base, coupon: coupon({ startsAt: new Date("2026-10-01T00:00:00Z") }) }).couponError, couponMessages.scheduled);
    assert.equal(price({ ...base, coupon: coupon({ status: "INACTIVE" }) }).couponError, couponMessages.inactive);
    assert.equal(price({ ...base, coupon: coupon({ applies: false }) }).couponError, couponMessages.course);
    assert.equal(price({ ...base, coupon: coupon({ minimumOrderCents: 400000 }) }).couponError, couponMessages.minimum);
    assert.equal(price({ ...base, coupon: coupon({ maxRedemptions: 1, redemptionCount: 1 }) }).couponError, couponMessages.limit);
    assert.equal(price({ ...base, coupon: coupon({ userRedemptionCount: 1 }) }).couponError, couponMessages.userLimit);
    assert.equal(price({ ...base, coupon: coupon({ discountValue: 120 }) }).couponError, couponMessages.inactive);
    assert.equal(price({ ...base, coupon: null }).couponError, null);
  });

  it("does not stack a coupon on top of a launch offer", () => {
    const quote = price({
      title: "Angular Signals",
      priceCents: 400000,
      currency: "EGP",
      now,
      promotions: [promotion()],
      coupon: coupon(),
    });
    assert.equal(quote.promotionName, "Angular Signals Launch Offer");
    assert.equal(quote.discountCents, 200000);
    assert.equal(quote.totalCents, 200000);
    assert.equal(quote.couponCode, null);
    assert.equal(quote.couponError, couponMessages.stack);
  });

  it("ignores a scheduled or expired offer and keeps the catalog price", () => {
    const later = price({
      title: "Angular Signals",
      priceCents: 400000,
      currency: "EGP",
      now: new Date("2026-10-11T00:00:00Z"),
      promotions: [promotion()],
      coupon: null,
    });
    assert.equal(later.totalCents, 400000);
    assert.equal(later.promotionName, null);
    const early = price({
      title: "Angular Signals",
      priceCents: 400000,
      currency: "EGP",
      now: new Date("2026-09-25T00:00:00Z"),
      promotions: [promotion()],
      coupon: null,
    });
    assert.equal(early.totalCents, 400000);
  });

  it("charges the discounted total rather than the list price", () => {
    const quote = price({
      title: "Angular Signals",
      priceCents: 400000,
      currency: "EGP",
      now,
      promotions: [promotion()],
      coupon: null,
    });
    assert.equal(quote.subtotalCents, 400000);
    assert.equal(quote.totalCents, 200000);
    assert.notEqual(quote.totalCents, quote.subtotalCents);
  });

  it("keeps an old quote stable after the promotion input changes", () => {
    const original = price({
      title: "Angular Signals",
      priceCents: 400000,
      currency: "EGP",
      now,
      promotions: [promotion()],
      coupon: null,
    });
    const next = price({
      title: "Angular Signals",
      priceCents: 250000,
      currency: "EGP",
      now,
      promotions: [],
      coupon: null,
    });
    assert.equal(original.totalCents, 200000);
    assert.equal(next.totalCents, 250000);
  });
});

describe("redemption limits", () => {
  it("refuses the next reservation when one use remains and it is already held", () => {
    assert.equal(reservationAllowed({ maxRedemptions: 1, otherRedemptions: 0, maxPerUser: 1, otherUserRedemptions: 0 }), true);
    assert.equal(reservationAllowed({ maxRedemptions: 1, otherRedemptions: 1, maxPerUser: 1, otherUserRedemptions: 0 }), false);
    assert.equal(reservationAllowed({ maxRedemptions: null, otherRedemptions: 4, maxPerUser: 1, otherUserRedemptions: 1 }), false);
  });
});
