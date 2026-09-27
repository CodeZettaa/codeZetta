import { db } from "@/lib/db";
import { calculatePrice, couponMessages, normalizeCouponCode, type CheckoutQuote } from "@/features/commerce/pricing";

const openStatuses = ["PENDING", "PAYMENT_PENDING", "FAILED"] as const;

async function activePromotions(courseId: string, now: Date) {
  return db.promotion.findMany({
    where: {
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gt: now },
      OR: [{ appliesToAll: true }, { courses: { some: { courseId } } }],
    },
    select: {
      id: true,
      name: true,
      status: true,
      discountType: true,
      discountValue: true,
      currency: true,
      startsAt: true,
      endsAt: true,
      appliesToAll: true,
    },
  });
}

export async function quoteCheckout(input: {
  userId: string;
  course: { id: string; title: string; priceCents: number; currency: string };
  couponCode: string | null;
  now?: Date;
}): Promise<CheckoutQuote> {
  const now = input.now ?? new Date();
  const promotions = await activePromotions(input.course.id, now);
  const code = input.couponCode ? normalizeCouponCode(input.couponCode) : null;
  const base = {
    title: input.course.title,
    priceCents: input.course.priceCents,
    currency: input.course.currency,
    now,
    promotions: promotions.map((promotion) => ({ ...promotion, applies: true })),
  };

  if (!code) return calculatePrice({ ...base, coupon: null });

  const coupon = await db.coupon.findUnique({
    where: { code },
    include: { courses: { select: { courseId: true } } },
  });
  if (!coupon) {
    const quote = calculatePrice({ ...base, coupon: null });
    return { ...quote, couponError: couponMessages.missing };
  }

  const openOrders = await db.order.findMany({
    where: {
      userId: input.userId,
      status: { in: [...openStatuses] },
      items: { some: { courseId: input.course.id } },
    },
    select: { id: true },
  });
  const openIds = openOrders.map((order) => order.id);
  const active = { in: ["RESERVED", "CONSUMED"] as ("RESERVED" | "CONSUMED")[] };
  const [redemptionCount, userRedemptionCount] = await Promise.all([
    db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        state: active,
        ...(openIds.length ? { orderId: { notIn: openIds } } : {}),
      },
    }),
    db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        userId: input.userId,
        state: active,
        ...(openIds.length ? { orderId: { notIn: openIds } } : {}),
      },
    }),
  ]);

  return calculatePrice({
    ...base,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      status: coupon.status,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      currency: coupon.currency,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      applies: coupon.appliesToAll || coupon.courses.some((row) => row.courseId === input.course.id),
      minimumOrderCents: coupon.minimumOrderCents,
      maxRedemptions: coupon.maxRedemptions,
      redemptionCount,
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
      userRedemptionCount,
    },
  });
}

export async function publicCoursePrice(course: { id: string; title: string; priceCents: number; currency: string }) {
  const now = new Date();
  const promotions = await activePromotions(course.id, now);
  return calculatePrice({
    title: course.title,
    priceCents: course.priceCents,
    currency: course.currency,
    now,
    promotions: promotions.map((promotion) => ({ ...promotion, applies: true })),
    coupon: null,
  });
}
