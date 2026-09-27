import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { quoteCheckout } from "@/features/commerce/offers";
import { couponMessages, reservationAllowed, type CheckoutQuote } from "@/features/commerce/pricing";
import { logPayment } from "@/features/commerce/log";
import { activePaymentProvider } from "@/features/commerce/mock-provider";
import type { VerifiedPaymentEvent } from "@/features/commerce/provider";
import {
  ATTEMPT_REUSE_MS,
  ORDER_TTL_MS,
  canEnrollFree,
  canReuseOpenOrder,
  canTransitionOrder,
  canTransitionPayment,
  decidePaymentEvent,
  purchaseBlocked,
} from "@/features/commerce/state";
import { grantEnrollment } from "@/server/enrollment";
import { logServerError } from "@/server/log";

const STUDENT_PAYMENT_ERROR = "We couldn't start the payment. Please try again.";

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function nextOrderNumber(tx: Prisma.TransactionClient) {
  const year = new Date().getUTCFullYear();
  await tx.$executeRaw`
    INSERT INTO "OrderSequence" ("year", "last")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "OrderSequence"."last" + 1
  `;
  const row = await tx.orderSequence.findUnique({ where: { year } });
  if (!row) throw new Error("Order number sequence did not persist.");
  return `CZ-${year}-${String(row.last).padStart(6, "0")}`;
}

async function publishedCourse(slug: string) {
  return db.course.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, status: true, priceCents: true, currency: true },
  });
}

/**
 * Pending orders are reused when the same student opens checkout again for the
 * same course at the same snapshotted price, currency, and discount, and the
 * order has not expired (24 hours). A price change cancels that pending order
 * and a new order snapshots the current price. Expired orders are not payable.
 */
async function releaseReservation(tx: Prisma.TransactionClient, orderId: string) {
  await tx.couponRedemption.updateMany({
    where: { orderId, state: "RESERVED" },
    data: { state: "RELEASED" },
  });
}

async function reserveCoupon(
  tx: Prisma.TransactionClient,
  input: { couponId: string; userId: string; orderId: string; discountCents: number },
) {
  await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${input.couponId} FOR UPDATE`;
  const coupon = await tx.coupon.findUnique({ where: { id: input.couponId } });
  const now = new Date();
  if (!coupon || coupon.status !== "ACTIVE") return false;
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return false;
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return false;

  const existing = await tx.couponRedemption.findUnique({ where: { orderId: input.orderId } });
  if (existing?.state === "CONSUMED") return false;
  const others = { not: input.orderId };
  const [otherRedemptions, otherUserRedemptions] = await Promise.all([
    tx.couponRedemption.count({
      where: { couponId: input.couponId, state: { in: ["RESERVED", "CONSUMED"] }, orderId: others },
    }),
    tx.couponRedemption.count({
      where: {
        couponId: input.couponId,
        userId: input.userId,
        state: { in: ["RESERVED", "CONSUMED"] },
        orderId: others,
      },
    }),
  ]);
  if (
    !reservationAllowed({
      maxRedemptions: coupon.maxRedemptions,
      otherRedemptions,
      maxPerUser: coupon.maxRedemptionsPerUser,
      otherUserRedemptions,
    })
  ) {
    return false;
  }

  if (existing) {
    await tx.couponRedemption.update({
      where: { id: existing.id },
      data: { state: "RESERVED", couponId: input.couponId, discountCents: input.discountCents, userId: input.userId },
    });
  } else {
    await tx.couponRedemption.create({
      data: {
        couponId: input.couponId,
        userId: input.userId,
        orderId: input.orderId,
        discountCents: input.discountCents,
        state: "RESERVED",
      },
    });
  }
  return true;
}

export async function upsertOpenOrder(userId: string, courseId: string, quote: CheckoutQuote) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const opens = await tx.order.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "PAYMENT_PENDING", "FAILED"] },
        items: { some: { courseId } },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    let reusable: (typeof opens)[number] | null = null;
    for (const order of opens) {
      if (
        canReuseOpenOrder(
          order,
          { ...quote, couponCode: quote.couponCode, promotionName: quote.promotionName },
          now,
        )
      ) {
        reusable ??= order;
        continue;
      }
      if (canTransitionOrder(order.status, "CANCELLED")) {
        await releaseReservation(tx, order.id);
        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
      }
    }

    if (reusable) return reusable;

    const orderNumber = await nextOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        status: "PENDING",
        currency: quote.currency,
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        totalCents: quote.totalCents,
        couponCodeSnapshot: quote.couponCode,
        promotionNameSnapshot: quote.promotionName,
        expiresAt: new Date(now.getTime() + ORDER_TTL_MS),
        items: {
          create: {
            courseId,
            courseTitleSnapshot: quote.courseTitleSnapshot,
            unitPriceCents: quote.unitPriceCents,
            quantity: quote.quantity,
            totalCents: quote.subtotalCents,
          },
        },
      },
      include: { items: true },
    });
    logPayment("order_created", {
      orderNumber: created.orderNumber,
      userId,
      totalCents: created.totalCents,
      currency: created.currency,
    });
    return created;
  });
}

async function openCouponCode(userId: string, courseId: string) {
  const order = await db.order.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "PAYMENT_PENDING", "FAILED"] },
      expiresAt: { gt: new Date() },
      items: { some: { courseId } },
    },
    orderBy: { createdAt: "desc" },
    select: { couponCodeSnapshot: true },
  });
  return order?.couponCodeSnapshot ?? null;
}

export async function prepareCheckout(userId: string, courseSlug: string) {
  const course = await publishedCourse(courseSlug);
  if (!course || course.status !== "PUBLISHED") return { kind: "missing" as const };
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { status: true },
  });
  if (purchaseBlocked(enrollment?.status ?? null)) return { kind: "owned" as const, course };
  if (course.priceCents === 0) return { kind: "free" as const, course };

  const requestedCode = await openCouponCode(userId, course.id);
  let quote = await quoteCheckout({ userId, course, couponCode: requestedCode });
  let notice: string | null = null;
  if (requestedCode && quote.couponError) {
    notice = quote.couponError;
    quote = await quoteCheckout({ userId, course, couponCode: null });
  }
  if (quote.totalCents > 0 && !activePaymentProvider()) return { kind: "unavailable" as const, course };
  const order = await upsertOpenOrder(userId, course.id, quote);
  return { kind: "ready" as const, course, order, notice };
}

export async function setCheckoutCoupon(userId: string, courseSlug: string, couponCode: string | null) {
  const course = await publishedCourse(courseSlug);
  if (!course || course.status !== "PUBLISHED" || course.priceCents <= 0) {
    return { error: "This course isn't available right now." };
  }
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { status: true },
  });
  if (purchaseBlocked(enrollment?.status ?? null)) return { error: "You already own this course." };

  const quote = await quoteCheckout({ userId, course, couponCode });
  if (couponCode && quote.couponError) return { error: quote.couponError };
  await upsertOpenOrder(userId, course.id, quote);
  return { ok: true as const };
}

async function finalizeZeroOrder(userId: string, orderId: string, quote: CheckoutQuote) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!fresh || fresh.userId !== userId || fresh.totalCents !== 0 || fresh.status === "PAID") {
      throw new Error("Zero-total order could not be finalized.");
    }
    if (quote.couponId) {
      const reserved = await reserveCoupon(tx, {
        couponId: quote.couponId,
        userId,
        orderId,
        discountCents: quote.discountCents,
      });
      if (!reserved) throw new Error("coupon-limit");
      await tx.couponRedemption.updateMany({
        where: { orderId, state: "RESERVED" },
        data: { state: "CONSUMED" },
      });
    }
    const now = new Date();
    await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: now } });
    for (const [index, item] of fresh.items.entries()) {
      await grantEnrollment(
        {
          userId,
          courseId: item.courseId,
          source: "PAYMENT",
          externalPaymentId: index === 0 ? `zero_${orderId}` : null,
        },
        tx,
      );
    }
  });
  logPayment("zero_total_paid", { orderId, userId });
}

export async function beginPayment(userId: string, courseSlug: string) {
  const course = await publishedCourse(courseSlug);
  if (!course || course.status !== "PUBLISHED" || course.priceCents <= 0) {
    return { error: STUDENT_PAYMENT_ERROR };
  }
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { status: true },
  });
  if (purchaseBlocked(enrollment?.status ?? null)) return { error: "You already own this course." };

  const requestedCode = await openCouponCode(userId, course.id);
  const quote = await quoteCheckout({ userId, course, couponCode: requestedCode });
  if (requestedCode && quote.couponError) {
    await upsertOpenOrder(userId, course.id, await quoteCheckout({ userId, course, couponCode: null }));
    return { error: quote.couponError };
  }
  if (quote.totalCents > 0 && !activePaymentProvider()) return { error: STUDENT_PAYMENT_ERROR };

  try {
    const order = await upsertOpenOrder(userId, course.id, quote);
    if (quote.totalCents === 0) {
      try {
        await finalizeZeroOrder(userId, order.id, quote);
      } catch (error) {
        if (error instanceof Error && error.message === "coupon-limit") {
          await upsertOpenOrder(userId, course.id, await quoteCheckout({ userId, course, couponCode: null }));
          return { error: couponMessages.limit };
        }
        throw error;
      }
      return { redirectUrl: `/checkout/success?order=${encodeURIComponent(order.orderNumber)}` };
    }

    const provider = activePaymentProvider();
    if (!provider) return { error: STUDENT_PAYMENT_ERROR };
    const redirectUrl = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (
        !fresh ||
        fresh.userId !== userId ||
        fresh.expiresAt <= new Date() ||
        fresh.status === "PAID" ||
        fresh.totalCents !== quote.totalCents
      ) {
        return { error: STUDENT_PAYMENT_ERROR };
      }
      if (fresh.status !== "PAYMENT_PENDING" && !canTransitionOrder(fresh.status, "PAYMENT_PENDING")) {
        return { error: STUDENT_PAYMENT_ERROR };
      }

      const recent = await tx.paymentAttempt.findFirst({
        where: {
          orderId: fresh.id,
          provider: provider.name,
          status: { in: ["PENDING", "PROCESSING"] },
          checkoutUrl: { not: null },
          createdAt: { gt: new Date(Date.now() - ATTEMPT_REUSE_MS) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent?.checkoutUrl) return { redirectUrl: recent.checkoutUrl };

      if (quote.couponId) {
        const reserved = await reserveCoupon(tx, {
          couponId: quote.couponId,
          userId,
          orderId: fresh.id,
          discountCents: quote.discountCents,
        });
        if (!reserved) {
          await tx.order.update({
            where: { id: fresh.id },
            data: { discountCents: 0, totalCents: fresh.subtotalCents, couponCodeSnapshot: null },
          });
          return { error: couponMessages.limit };
        }
      }

      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: fresh.id,
          provider: provider.name,
          status: "PENDING",
          amountCents: fresh.totalCents,
          currency: fresh.currency,
        },
      });
      const session = await provider.createPayment({
        attemptId: attempt.id,
        orderNumber: fresh.orderNumber,
        amountCents: fresh.totalCents,
        currency: fresh.currency,
      });
      if (!canTransitionPayment("PENDING", "PROCESSING")) {
        throw new Error("Invalid payment transition.");
      }
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PROCESSING",
          providerPaymentId: session.providerPaymentId,
          checkoutUrl: session.redirectUrl,
        },
      });
      if (fresh.status !== "PAYMENT_PENDING") {
        await tx.order.update({ where: { id: fresh.id }, data: { status: "PAYMENT_PENDING" } });
      }
      logPayment("payment_attempt_created", {
        orderNumber: fresh.orderNumber,
        paymentAttemptId: attempt.id,
        provider: provider.name,
      });
      return { redirectUrl: session.redirectUrl };
    });
    return redirectUrl;
  } catch (error) {
    logServerError("beginPayment", error);
    logPayment("payment_attempt_failed", { userId, courseSlug });
    return { error: STUDENT_PAYMENT_ERROR };
  }
}

export async function enrollFreeCourse(userId: string, courseSlug: string) {
  const course = await publishedCourse(courseSlug);
  if (!course || !canEnrollFree(course)) return { error: "This course isn't available right now." };
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { status: true },
  });
  if (purchaseBlocked(enrollment?.status ?? null)) return { error: "You already own this course." };
  try {
    await grantEnrollment({ userId, courseId: course.id, source: "FREE" });
  } catch (error) {
    logServerError("enrollFreeCourse", error);
    return { error: "We couldn't enroll you. Please try again." };
  }
  logPayment("free_enrollment_created", { userId, courseId: course.id });
  return { ok: true as const, slug: course.slug };
}

async function markEvent(tx: Prisma.TransactionClient, id: string, outcome: string) {
  await tx.webhookEvent.update({ where: { id }, data: { outcome } });
}

export async function applyVerifiedEvent(event: VerifiedPaymentEvent) {
  return db.$transaction(async (tx) => {
    let webhookId: string;
    try {
      const row = await tx.webhookEvent.create({
        data: {
          provider: event.provider,
          providerEventId: event.eventId,
          type: event.type,
          outcome: "processing",
        },
      });
      webhookId = row.id;
    } catch (error) {
      if (isUniqueViolation(error)) return { outcome: "duplicate" as const };
      throw error;
    }

    const attempt = await tx.paymentAttempt.findUnique({
      where: { id: event.paymentAttemptId },
      include: {
        order: {
          include: {
            items: true,
            payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
          },
        },
      },
    });

    const decision = decidePaymentEvent({
      alreadyProcessed: false,
      attemptFound: Boolean(attempt) && attempt?.provider === event.provider,
      orderStatus: attempt?.order.status ?? "PENDING",
      attemptStatus: attempt?.status ?? "PENDING",
      attemptId: attempt?.id ?? "",
      payingAttemptId: attempt?.order.payments[0]?.id ?? null,
      eventType: event.type,
      eventAmountCents: event.amountCents,
      orderTotalCents: attempt?.order.totalCents ?? -1,
      eventCurrency: event.currency,
      orderCurrency: attempt?.order.currency ?? "",
    });

    if (!attempt || decision.action === "unknown") {
      await markEvent(tx, webhookId, "unknown");
      logPayment("webhook_unknown", { providerEventId: event.eventId, paymentAttemptId: event.paymentAttemptId });
      return { outcome: "unknown" as const };
    }

    if (
      attempt.providerPaymentId &&
      attempt.providerPaymentId !== event.providerPaymentId
    ) {
      await markEvent(tx, webhookId, "rejected_provider");
      return { outcome: "rejected_provider" as const };
    }

    if (decision.action === "reject") {
      await markEvent(tx, webhookId, `rejected_${decision.reason}`);
      logPayment("webhook_rejected", {
        orderNumber: attempt.order.orderNumber,
        paymentAttemptId: attempt.id,
        reason: decision.reason,
      });
      return { outcome: `rejected_${decision.reason}` as const };
    }

    if (decision.action === "duplicate" || decision.action === "ignore") {
      await markEvent(tx, webhookId, decision.action === "duplicate" ? "duplicate" : `ignored_${decision.reason}`);
      return { outcome: decision.action === "duplicate" ? ("duplicate" as const) : ("ignored" as const) };
    }

    if (decision.action === "flag_review") {
      if (canTransitionPayment(attempt.status, "SUCCEEDED")) {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "SUCCEEDED",
            confirmedAt: new Date(),
            providerTransactionId: event.eventId,
          },
        });
      }
      await tx.order.update({ where: { id: attempt.orderId }, data: { reviewRequired: true } });
      await markEvent(tx, webhookId, "review_required");
      logPayment("payment_review_required", {
        orderNumber: attempt.order.orderNumber,
        paymentAttemptId: attempt.id,
        providerTransactionId: event.providerPaymentId,
      });
      return { outcome: "review_required" as const };
    }

    if (decision.action === "succeed") {
      if (!canTransitionPayment(attempt.status, "SUCCEEDED") || !canTransitionOrder(attempt.order.status, "PAID")) {
        await markEvent(tx, webhookId, "invalid_transition");
        return { outcome: "invalid_transition" as const };
      }
      const now = new Date();
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUCCEEDED",
          confirmedAt: now,
          providerTransactionId: event.eventId,
        },
      });
      await tx.order.update({
        where: { id: attempt.orderId },
        data: { status: "PAID", paidAt: now },
      });
      if (attempt.order.couponCodeSnapshot) {
        const consumed = await tx.couponRedemption.updateMany({
          where: { orderId: attempt.orderId, state: "RESERVED" },
          data: { state: "CONSUMED" },
        });
        if (consumed.count === 0) {
          const redemption = await tx.couponRedemption.findUnique({ where: { orderId: attempt.orderId } });
          if (redemption?.state !== "CONSUMED") {
            await tx.order.update({ where: { id: attempt.orderId }, data: { reviewRequired: true } });
          }
        }
      }
      for (const [index, item] of attempt.order.items.entries()) {
        await grantEnrollment(
          {
            userId: attempt.order.userId,
            courseId: item.courseId,
            source: "PAYMENT",
            externalPaymentId: index === 0 ? event.providerPaymentId : null,
          },
          tx,
        );
      }
      await markEvent(tx, webhookId, "paid");
      logPayment("payment_succeeded", {
        orderNumber: attempt.order.orderNumber,
        paymentAttemptId: attempt.id,
        providerTransactionId: event.providerPaymentId,
      });
      logPayment("enrollment_created", {
        orderNumber: attempt.order.orderNumber,
        paymentAttemptId: attempt.id,
      });
      return { outcome: "paid" as const };
    }

    if (decision.action === "fail") {
      if (!canTransitionPayment(attempt.status, "FAILED") || !canTransitionOrder(attempt.order.status, "FAILED")) {
        await markEvent(tx, webhookId, "invalid_transition");
        return { outcome: "invalid_transition" as const };
      }
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED" } });
      await tx.order.update({ where: { id: attempt.orderId }, data: { status: "FAILED" } });
      await releaseReservation(tx, attempt.orderId);
      await markEvent(tx, webhookId, "failed");
      logPayment("payment_failed", { orderNumber: attempt.order.orderNumber, paymentAttemptId: attempt.id });
      return { outcome: "failed" as const };
    }

    if (!canTransitionPayment(attempt.status, "CANCELLED")) {
      await markEvent(tx, webhookId, "invalid_transition");
      return { outcome: "invalid_transition" as const };
    }
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "CANCELLED" } });
    await releaseReservation(tx, attempt.orderId);
    if (attempt.order.status === "PAYMENT_PENDING" && canTransitionOrder("PAYMENT_PENDING", "PENDING")) {
      await tx.order.update({ where: { id: attempt.orderId }, data: { status: "PENDING" } });
    }
    await markEvent(tx, webhookId, "cancelled");
    logPayment("payment_cancelled", { orderNumber: attempt.order.orderNumber, paymentAttemptId: attempt.id });
    return { outcome: "cancelled" as const };
  });
}

export async function receiveWebhook(providerName: string, rawBody: string, signature: string | null) {
  const provider = activePaymentProvider();
  logPayment("webhook_received", { provider: providerName });
  if (!provider || provider.name !== providerName) return { httpStatus: 404, outcome: "unavailable" };
  const event = provider.verifyWebhook(rawBody, signature);
  if (!event) {
    logPayment("webhook_rejected", { provider: providerName, reason: "signature" });
    return { httpStatus: 401, outcome: "invalid_signature" };
  }
  logPayment("webhook_verified", { provider: providerName, providerEventId: event.eventId });
  const result = await applyVerifiedEvent(event);
  return { httpStatus: 200, outcome: result.outcome };
}

export async function reconcilePaidOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { where: { status: "SUCCEEDED" }, orderBy: { confirmedAt: "asc" }, take: 1 },
    },
  });
  if (!order || order.status !== "PAID") return { error: "Only a paid order can be reconciled." };
  let created = 0;
  let existing = 0;
  for (const item of order.items) {
    const result = await grantEnrollment({
      userId: order.userId,
      courseId: item.courseId,
      source: "PAYMENT",
      externalPaymentId: order.payments[0]?.providerPaymentId ?? null,
    });
    if (result.outcome === "granted") created += 1;
    else existing += 1;
  }
  logPayment("order_reconciled", { orderNumber: order.orderNumber, created, existing });
  return { ok: true as const, created, existing };
}
