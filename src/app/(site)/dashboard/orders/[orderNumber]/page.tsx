import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { displayOrderStatus, paymentStatusLabel } from "@/features/commerce/labels";
import { getStudentOrder } from "@/features/commerce/queries";
import { formatDiscount, formatPrice } from "@/features/courses/format";
import { formatDate } from "@/lib/time";
import { requireUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await requireUser();
  const { orderNumber } = await params;
  if (!/^CZ-\d{4}-\d{6}$/.test(orderNumber)) notFound();
  const order = await getStudentOrder(user.id, orderNumber);
  if (!order) notFound();
  const latest = order.payments.at(-1);

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 md:px-8 md:py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Order receipt</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">{order.orderNumber}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
      <p className="mt-4 text-sm" role="status">
        Status: {displayOrderStatus(order)}
        {latest ? ` · Payment: ${paymentStatusLabel(latest.status)}` : null}
      </p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {order.items.map((item) => (
          <li key={item.courseTitleSnapshot} className="flex items-start justify-between gap-4 py-4 text-sm">
            <span>
              <Link href={`/courses/${item.course.slug}`} className="hover:underline">
                {item.courseTitleSnapshot}
              </Link>
              <span className="mt-1 block text-muted-foreground">Qty {item.quantity}</span>
            </span>
            <span>{formatPrice(item.totalCents, order.currency)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatPrice(order.subtotalCents, order.currency)}</dd>
        </div>
        {order.discountCents > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>
              {formatDiscount(order.discountCents, order.currency)}
              {order.couponCodeSnapshot ? ` · ${order.couponCodeSnapshot}` : ""}
              {order.promotionNameSnapshot ? ` · ${order.promotionNameSnapshot}` : ""}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between text-base font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(order.totalCents, order.currency)}</dd>
        </div>
      </dl>
      <p className="mt-8 text-xs leading-5 text-muted-foreground">Purchase summary. This is not a tax invoice.</p>
    </main>
  );
}
