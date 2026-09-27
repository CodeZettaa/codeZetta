import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { OfferFields } from "@/features/commerce/components/offer-fields";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/authz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coupon" };

export default async function EditCouponPage({ params }: { params: Promise<{ couponId: string }> }) {
  await requireAdmin();
  const { couponId } = await params;
  const [coupon, courses] = await Promise.all([
    db.coupon.findUnique({ where: { id: couponId }, include: { courses: true, _count: { select: { redemptions: { where: { state: "CONSUMED" } } } } } }),
    db.course.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, priceCents: true, currency: true },
    }),
  ]);
  if (!coupon) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/coupons" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">{coupon.code}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{coupon._count.redemptions} paid redemptions</p>
      <OfferFields
        kind="coupon"
        courses={courses}
        initial={{
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          currency: coupon.currency,
          status: coupon.status,
          startsAt: coupon.startsAt,
          endsAt: coupon.expiresAt,
          appliesToAll: coupon.appliesToAll,
          courseIds: coupon.courses.map((row) => row.courseId),
          maxRedemptions: coupon.maxRedemptions,
          maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
          minimumOrderCents: coupon.minimumOrderCents,
        }}
      />
    </main>
  );
}
