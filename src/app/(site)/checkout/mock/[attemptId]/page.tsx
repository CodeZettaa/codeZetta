import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockOutcomeForm } from "@/features/commerce/components/mock-outcome-form";
import { isMockProviderEnabled } from "@/features/commerce/provider";
import { formatPrice } from "@/features/courses/format";
import { db } from "@/lib/db";
import { requireUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Development payment" };

export default async function MockCheckoutPage({ params }: { params: Promise<{ attemptId: string }> }) {
  if (!isMockProviderEnabled()) notFound();
  const user = await requireUser();
  const { attemptId } = await params;
  const attempt = await db.paymentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      order: {
        select: {
          userId: true,
          orderNumber: true,
          totalCents: true,
          currency: true,
          items: { select: { courseTitleSnapshot: true } },
        },
      },
    },
  });
  if (!attempt || attempt.order.userId !== user.id || attempt.provider !== "mock") notFound();

  return (
    <main className="mx-auto w-full max-w-md px-5 py-12 md:py-16">
      <p className="rounded-xl border border-primary/40 px-4 py-3 text-sm text-primary" role="status">
        Development payment. No card is charged. This page is unavailable in production.
      </p>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">Simulate a payment</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {attempt.order.items[0]?.courseTitleSnapshot} · {attempt.order.orderNumber} ·{" "}
        {formatPrice(attempt.amountCents, attempt.currency)}
      </p>
      <div className="mt-8">
        <MockOutcomeForm attemptId={attempt.id} />
      </div>
    </main>
  );
}
