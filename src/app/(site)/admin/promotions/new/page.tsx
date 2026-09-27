import type { Metadata } from "next";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { OfferFields } from "@/features/commerce/components/offer-fields";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/authz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New promotion" };

export default async function NewPromotionPage() {
  await requireAdmin();
  const courses = await db.course.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, priceCents: true, currency: true },
  });
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/promotions" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">New promotion</h1>
      <OfferFields kind="promotion" courses={courses} />
    </main>
  );
}
