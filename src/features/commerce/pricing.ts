import { orderTotal } from "@/features/commerce/money";

/**
 * One discount per order.
 * An active promotion is used by itself. A coupon is rejected while that promotion applies.
 * A coupon is calculated from the catalog price only when no promotion is active.
 * The two discounts are never added together.
 */
export const DISCOUNT_STACKING_POLICY = "promotion-or-coupon";

export const couponMessages = {
  missing: "This coupon doesn't exist.",
  inactive: "This coupon isn't available.",
  scheduled: "This coupon isn't available yet.",
  expired: "This coupon has expired.",
  course: "This coupon isn't valid for this course.",
  minimum: "This order doesn't meet the minimum for this coupon.",
  limit: "This coupon has reached its usage limit.",
  userLimit: "You've already used this coupon.",
  stack: "This coupon can't be combined with the current offer.",
  currency: "This coupon isn't valid for this course.",
} as const;

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type OfferStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export type PromotionInput = {
  id: string;
  name: string;
  status: OfferStatus;
  discountType: DiscountType;
  discountValue: number;
  currency: string | null;
  startsAt: Date;
  endsAt: Date;
  applies: boolean;
};

export type CouponInput = {
  id: string;
  code: string;
  status: OfferStatus;
  discountType: DiscountType;
  discountValue: number;
  currency: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  applies: boolean;
  minimumOrderCents: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  maxRedemptionsPerUser: number;
  userRedemptionCount: number;
};

export type CheckoutQuote = {
  courseTitleSnapshot: string;
  unitPriceCents: number;
  quantity: 1;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  couponCode: string | null;
  couponId: string | null;
  promotionName: string | null;
  promotionId: string | null;
  promotionEndsAt: Date | null;
  couponError: string | null;
};

export function normalizeCouponCode(value: string) {
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return null;
  return code;
}

export function percentageOff(baseCents: number, percent: number) {
  if (!Number.isSafeInteger(baseCents) || baseCents < 0) throw new Error("Price must be an integer minor unit.");
  if (!Number.isSafeInteger(percent) || percent < 1 || percent > 100) throw new Error("Percent must be from 1 to 100.");
  return Math.floor((baseCents * percent) / 100);
}

export function fixedOff(baseCents: number, amountCents: number) {
  if (!Number.isSafeInteger(baseCents) || baseCents < 0) throw new Error("Price must be an integer minor unit.");
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Discount must be an integer minor unit.");
  return Math.min(baseCents, amountCents);
}

export function discountAmount(baseCents: number, type: DiscountType, value: number) {
  if (type === "PERCENTAGE") return percentageOff(baseCents, value);
  return fixedOff(baseCents, value);
}

function promotionActive(promotion: PromotionInput, now: Date) {
  return (
    promotion.applies &&
    promotion.status === "ACTIVE" &&
    promotion.startsAt.getTime() <= now.getTime() &&
    promotion.endsAt.getTime() > now.getTime()
  );
}

function couponProblem(coupon: CouponInput, priceCents: number, currency: string, now: Date, promotionApplied: boolean) {
  if (promotionApplied) return couponMessages.stack;
  if (coupon.status === "DRAFT" || coupon.status === "INACTIVE") return couponMessages.inactive;
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return couponMessages.scheduled;
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return couponMessages.expired;
  if (!coupon.applies) return couponMessages.course;
  if (coupon.discountType === "FIXED_AMOUNT" && coupon.currency !== currency) return couponMessages.currency;
  if (coupon.discountType === "PERCENTAGE" && (coupon.discountValue < 1 || coupon.discountValue > 100)) {
    return couponMessages.inactive;
  }
  if (coupon.discountType === "FIXED_AMOUNT" && coupon.discountValue < 1) return couponMessages.inactive;
  if (priceCents < coupon.minimumOrderCents) return couponMessages.minimum;
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) return couponMessages.limit;
  if (coupon.userRedemptionCount >= coupon.maxRedemptionsPerUser) return couponMessages.userLimit;
  return null;
}

/**
 * Catalog price in, one discount out. `now` is the server clock.
 * The returned numbers are the snapshot to store on the order.
 */
export function calculatePrice(input: {
  title: string;
  priceCents: number;
  currency: string;
  now: Date;
  promotions: PromotionInput[];
  coupon: CouponInput | null;
}): CheckoutQuote {
  const subtotalCents = input.priceCents;
  const active = input.promotions
    .filter((promotion) => promotionActive(promotion, input.now))
    .filter((promotion) => promotion.discountType === "PERCENTAGE" || promotion.currency === input.currency)
    .filter((promotion) => {
      if (promotion.discountType === "PERCENTAGE") return promotion.discountValue >= 1 && promotion.discountValue <= 100;
      return promotion.discountValue >= 1;
    })
    .map((promotion) => ({
      promotion,
      discountCents: discountAmount(subtotalCents, promotion.discountType, promotion.discountValue),
    }))
    .sort((a, b) => b.discountCents - a.discountCents || a.promotion.endsAt.getTime() - b.promotion.endsAt.getTime());

  const chosen = active[0] ?? null;
  if (chosen) {
    const discountCents = chosen.discountCents;
    return {
      courseTitleSnapshot: input.title,
      unitPriceCents: subtotalCents,
      quantity: 1,
      subtotalCents,
      discountCents,
      totalCents: orderTotal(subtotalCents, discountCents),
      currency: input.currency,
      couponCode: null,
      couponId: null,
      promotionName: chosen.promotion.name,
      promotionId: chosen.promotion.id,
      promotionEndsAt: chosen.promotion.endsAt,
      couponError: input.coupon ? couponMessages.stack : null,
    };
  }

  if (!input.coupon) {
    return {
      courseTitleSnapshot: input.title,
      unitPriceCents: subtotalCents,
      quantity: 1,
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
      currency: input.currency,
      couponCode: null,
      couponId: null,
      promotionName: null,
      promotionId: null,
      promotionEndsAt: null,
      couponError: null,
    };
  }

  const problem = couponProblem(input.coupon, subtotalCents, input.currency, input.now, false);
  if (problem) {
    return {
      courseTitleSnapshot: input.title,
      unitPriceCents: subtotalCents,
      quantity: 1,
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
      currency: input.currency,
      couponCode: null,
      couponId: null,
      promotionName: null,
      promotionId: null,
      promotionEndsAt: null,
      couponError: problem,
    };
  }

  const discountCents = discountAmount(subtotalCents, input.coupon.discountType, input.coupon.discountValue);
  return {
    courseTitleSnapshot: input.title,
    unitPriceCents: subtotalCents,
    quantity: 1,
    subtotalCents,
    discountCents,
    totalCents: orderTotal(subtotalCents, discountCents),
    currency: input.currency,
    couponCode: input.coupon.code,
    couponId: input.coupon.id,
    promotionName: null,
    promotionId: null,
    promotionEndsAt: null,
    couponError: null,
  };
}

/** Counts reserved and consumed redemptions, excluding the order currently being checked. */
export function reservationAllowed(input: {
  maxRedemptions: number | null;
  otherRedemptions: number;
  maxPerUser: number;
  otherUserRedemptions: number;
}) {
  if (input.maxRedemptions !== null && input.otherRedemptions >= input.maxRedemptions) return false;
  if (input.otherUserRedemptions >= input.maxPerUser) return false;
  return true;
}

export function offerTiming(
  status: OfferStatus,
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
) {
  if (status === "DRAFT") return "Draft";
  if (status === "INACTIVE") return "Inactive";
  if (startsAt && startsAt.getTime() > now.getTime()) return "Scheduled";
  if (endsAt && endsAt.getTime() <= now.getTime()) return "Expired";
  return "Active";
}

export function parseUtcDateTimeLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function utcDateTimeLocal(date: Date) {
  return date.toISOString().slice(0, 16);
}
