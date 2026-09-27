"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { isMockProviderEnabled, signMockBody } from "@/features/commerce/provider";
import { enrollFreeCourse, beginPayment, receiveWebhook, reconcilePaidOrder, setCheckoutCoupon } from "@/features/commerce/service";
import { requireAdmin, requireUser } from "@/server/authz";

const slugSchema = z.string().trim().min(1).max(80);
const attemptSchema = z.string().trim().min(8).max(64);
const outcomeSchema = z.enum(["succeeded", "failed", "cancelled"]);

export async function applyCoupon(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const slug = slugSchema.safeParse(formData.get("courseSlug"));
  const code = z.string().trim().min(1).max(40).safeParse(formData.get("code"));
  if (!slug.success || !code.success) return "This coupon doesn't exist.";
  const result = await setCheckoutCoupon(user.id, slug.data, code.data);
  if ("error" in result) return result.error ?? "This coupon isn't available.";
  revalidatePath(`/checkout/${slug.data}`);
  return null;
}

export async function removeCoupon(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const slug = slugSchema.safeParse(formData.get("courseSlug"));
  if (!slug.success) return "This course isn't available right now.";
  const result = await setCheckoutCoupon(user.id, slug.data, null);
  if ("error" in result) return result.error ?? "This course isn't available right now.";
  revalidatePath(`/checkout/${slug.data}`);
  return null;
}

export async function continueToPayment(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const slug = slugSchema.safeParse(formData.get("courseSlug"));
  if (!slug.success) return "We couldn't start the payment. Please try again.";
  const result = await beginPayment(user.id, slug.data);
  if ("error" in result) return result.error ?? "We couldn't start the payment. Please try again.";
  redirect(result.redirectUrl);
}

export async function enrollInFreeCourse(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const slug = slugSchema.safeParse(formData.get("courseSlug"));
  if (!slug.success) return "This course isn't available right now.";
  const result = await enrollFreeCourse(user.id, slug.data);
  if ("error" in result) return result.error ?? "This course isn't available right now.";
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${result.slug}`);
  redirect(`/courses/${result.slug}?enrolled=1`);
}

export async function simulateMockOutcome(_previous: string | null, formData: FormData): Promise<string | null> {
  const user = await requireUser();
  if (!isMockProviderEnabled()) return "Payments aren't available.";
  const attemptId = attemptSchema.safeParse(formData.get("attemptId"));
  const outcome = outcomeSchema.safeParse(formData.get("outcome"));
  if (!attemptId.success || !outcome.success) return "That payment session isn't available.";

  const attempt = await db.paymentAttempt.findUnique({
    where: { id: attemptId.data },
    include: { order: { select: { userId: true, orderNumber: true } } },
  });
  if (!attempt || attempt.order.userId !== user.id || attempt.provider !== "mock" || !attempt.providerPaymentId) {
    return "That payment session isn't available.";
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return "Payments aren't available.";

  const body = JSON.stringify({
    id: `mockevt_${outcome.data}_${crypto.randomUUID().replaceAll("-", "")}`,
    type: `payment.${outcome.data}`,
    paymentAttemptId: attempt.id,
    amount: attempt.amountCents,
    currency: attempt.currency,
    providerPaymentId: attempt.providerPaymentId,
  });
  const result = await receiveWebhook("mock", body, signMockBody(body, secret));
  if (result.httpStatus === 401) return "We couldn't confirm that payment.";

  const next = outcome.data === "succeeded" ? "/checkout/success" : "/checkout/failed";
  redirect(`${next}?order=${encodeURIComponent(attempt.order.orderNumber)}`);
}

export async function reconcileOrder(_previous: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();
  const orderId = z.string().trim().min(1).max(64).safeParse(formData.get("orderId"));
  if (!orderId.success) return "Choose an order.";
  const result = await reconcilePaidOrder(orderId.data);
  if ("error" in result) return result.error ?? "Only a paid order can be reconciled.";
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  return null;
}
