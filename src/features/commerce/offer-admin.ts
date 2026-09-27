"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromDollars } from "@/features/admin/schemas";
import { normalizeCouponCode, parseUtcDateTimeLocal } from "@/features/commerce/pricing";
import { requireAdmin } from "@/server/authz";

const offerStatus = z.enum(["DRAFT", "ACTIVE", "INACTIVE"]);
const discountType = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]);

function courseIds(formData: FormData) {
  return formData.getAll("courseIds").flatMap((value) => (typeof value === "string" && value ? [value] : []));
}

function discountFrom(formData: FormData) {
  const type = discountType.safeParse(formData.get("discountType"));
  const raw = z.string().trim().safeParse(formData.get("discountValue"));
  const currency = z.enum(["USD", "EGP"]).safeParse(formData.get("currency"));
  if (!type.success || !raw.success) return { error: "Enter a discount." as const };
  if (type.data === "PERCENTAGE") {
    const percent = Number(raw.data);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { error: "Percentage must be a whole number from 1 to 100." as const };
    return { type: type.data, value: percent, currency: null };
  }
  if (!currency.success) return { error: "Choose the currency for a fixed discount." as const };
  const cents = centsFromDollars(raw.data);
  if (cents === null || cents < 1) return { error: "Enter a fixed discount greater than zero." as const };
  return { type: type.data, value: cents, currency: currency.data };
}

export async function saveCoupon(_previous: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();
  const id = z.string().trim().max(64).safeParse(formData.get("id"));
  const code = normalizeCouponCode(String(formData.get("code") ?? ""));
  if (!code) return "Use 3–32 letters or numbers.";
  const discount = discountFrom(formData);
  if ("error" in discount) return discount.error ?? "Enter a discount.";
  const status = offerStatus.safeParse(formData.get("status"));
  if (!status.success) return "Choose a status.";
  const appliesToAll = formData.get("appliesTo") !== "selected";
  const selected = courseIds(formData);
  if (!appliesToAll && selected.length === 0) return "Choose at least one course.";
  const startsAt = String(formData.get("startsAt") ?? "");
  const expiresAt = String(formData.get("expiresAt") ?? "");
  const starts = startsAt ? parseUtcDateTimeLocal(startsAt) : null;
  const expires = expiresAt ? parseUtcDateTimeLocal(expiresAt) : null;
  if ((startsAt && !starts) || (expiresAt && !expires)) return "Enter dates as UTC.";
  if (starts && expires && expires <= starts) return "The end must be after the start.";
  const maxRaw = String(formData.get("maxRedemptions") ?? "").trim();
  const maxRedemptions = maxRaw ? Number(maxRaw) : null;
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) return "Maximum uses must be a whole number.";
  const perUser = Number(formData.get("maxRedemptionsPerUser") ?? "1");
  if (!Number.isInteger(perUser) || perUser < 1) return "Uses per student must be at least 1.";
  const minimum = centsFromDollars(String(formData.get("minimumOrder") ?? ""));
  if (minimum === null) return "Enter a valid minimum, or leave it blank.";
  const description = z.string().trim().max(280).safeParse(formData.get("description") ?? "");
  if (!description.success) return "Keep the description under 280 characters.";

  const data = {
    code,
    description: description.data,
    discountType: discount.type,
    discountValue: discount.value,
    currency: discount.currency,
    status: status.data,
    startsAt: starts,
    expiresAt: expires,
    maxRedemptions,
    maxRedemptionsPerUser: perUser,
    minimumOrderCents: minimum,
    appliesToAll,
  };

  const couponId = id.success && id.data ? id.data : null;
  let savedId = couponId;
  try {
    const saved = couponId
      ? await db.coupon.update({ where: { id: couponId }, data })
      : await db.coupon.create({ data });
    savedId = saved.id;
    await db.couponCourse.deleteMany({ where: { couponId: saved.id } });
    if (!appliesToAll) {
      await db.couponCourse.createMany({ data: selected.map((courseId) => ({ couponId: saved.id, courseId })) });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "That code is already in use.";
    }
    throw error;
  }
  revalidatePath("/admin/coupons");
  if (!couponId && savedId) redirect(`/admin/coupons/${savedId}`);
  return null;
}

export async function savePromotion(_previous: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();
  const id = z.string().trim().max(64).safeParse(formData.get("id"));
  const name = z.string().trim().min(2).max(80).safeParse(formData.get("name"));
  if (!name.success) return "Name the offer.";
  const discount = discountFrom(formData);
  if ("error" in discount) return discount.error ?? "Enter a discount.";
  const status = offerStatus.safeParse(formData.get("status"));
  if (!status.success) return "Choose a status.";
  const starts = parseUtcDateTimeLocal(String(formData.get("startsAt") ?? ""));
  const ends = parseUtcDateTimeLocal(String(formData.get("endsAt") ?? ""));
  if (!starts || !ends || ends <= starts) return "Enter a UTC start and end, with the end after the start.";
  const appliesToAll = formData.get("appliesTo") === "all";
  const selected = courseIds(formData);
  if (!appliesToAll && selected.length === 0) return "Choose at least one course.";

  const data = {
    name: name.data,
    discountType: discount.type,
    discountValue: discount.value,
    currency: discount.currency,
    status: status.data,
    startsAt: starts,
    endsAt: ends,
    appliesToAll,
  };
  const saved = id.success && id.data
    ? await db.promotion.update({ where: { id: id.data }, data })
    : await db.promotion.create({ data });
  await db.promotionCourse.deleteMany({ where: { promotionId: saved.id } });
  if (!appliesToAll) {
    await db.promotionCourse.createMany({ data: selected.map((courseId) => ({ promotionId: saved.id, courseId })) });
  }
  revalidatePath("/admin/promotions");
  revalidatePath("/courses");
  if (!id.success || !id.data) redirect(`/admin/promotions/${saved.id}`);
  return null;
}
