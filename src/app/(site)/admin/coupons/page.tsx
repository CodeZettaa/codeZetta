import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { offerTiming } from "@/features/commerce/pricing";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/authz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      courses: { include: { course: { select: { title: true } } } },
      _count: { select: { redemptions: { where: { state: "CONSUMED" } } } },
    },
  });
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/coupons" />
      <div className="mt-8 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-medium tracking-tight">Coupons</h1>
        <Link href="/admin/coupons/new" className="text-sm underline-offset-4 hover:underline">
          New coupon
        </Link>
      </div>
      {coupons.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {coupons.map((coupon) => (
            <li key={coupon.id}>
              <Link href={`/admin/coupons/${coupon.id}`} className="grid gap-1 px-4 py-4 text-sm hover:bg-muted/40 md:grid-cols-[8rem_6rem_minmax(0,1fr)_6rem_6rem_7rem] md:items-center">
                <span className="font-mono">{coupon.code}</span>
                <span>{coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : coupon.discountValue / 100}</span>
                <span className="truncate">{coupon.appliesToAll ? "All courses" : coupon.courses.map((row) => row.course.title).join(", ")}</span>
                <span>
                  {coupon._count.redemptions}
                  {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                </span>
                <span>{offerTiming(coupon.status, coupon.startsAt, coupon.expiresAt, now)}</span>
                <span className="text-muted-foreground">{coupon.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : "No expiry"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
