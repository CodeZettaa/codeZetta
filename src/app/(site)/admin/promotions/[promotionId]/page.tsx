import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { OfferFields } from "@/features/commerce/components/offer-fields";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/authz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Promotion" };

export default async function EditPromotionPage({ params }: { params: Promise<{ promotionId: string }> }) {
  await requireAdmin();
  const { promotionId } = await params;
  const [promotion, courses] = await Promise.all([
    db.promotion.findUnique({ where: { id: promotionId }, include: { courses: true } }),
    db.course.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, priceCents: true, currency: true },
    }),
  ]);
  if (!promotion) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/promotions" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">{promotion.name}</h1>
      <OfferFields
        kind="promotion"
        courses={courses}
        initial={{
          id: promotion.id,
          name: promotion.name,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          currency: promotion.currency,
          status: promotion.status,
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          appliesToAll: promotion.appliesToAll,
          courseIds: promotion.courses.map((row) => row.courseId),
        }}
      />
    </main>
  );
}
