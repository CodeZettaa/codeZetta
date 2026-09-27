import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { offerTiming } from "@/features/commerce/pricing";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/authz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  await requireAdmin();
  const promotions = await db.promotion.findMany({
    orderBy: { startsAt: "desc" },
    include: { courses: { include: { course: { select: { title: true } } } } },
  });
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/promotions" />
      <div className="mt-8 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-medium tracking-tight">Promotions</h1>
        <Link href="/admin/promotions/new" className="text-sm underline-offset-4 hover:underline">
          New promotion
        </Link>
      </div>
      {promotions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No promotions yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {promotions.map((promotion) => (
            <li key={promotion.id}>
              <Link href={`/admin/promotions/${promotion.id}`} className="grid gap-1 px-4 py-4 text-sm hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)_8rem]">
                <span>{promotion.name}</span>
                <span>{promotion.discountType === "PERCENTAGE" ? `${promotion.discountValue}% off` : "Fixed"}</span>
                <span className="truncate">{promotion.appliesToAll ? "All courses" : promotion.courses.map((row) => row.course.title).join(", ")}</span>
                <span>
                  {offerTiming(promotion.status, promotion.startsAt, promotion.endsAt, now)} · {promotion.startsAt.toISOString().slice(0, 10)} → {promotion.endsAt.toISOString().slice(0, 10)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
