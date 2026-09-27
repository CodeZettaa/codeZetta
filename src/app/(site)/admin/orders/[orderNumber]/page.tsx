import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoundForm } from "@/features/admin/components/bound-form";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { reconcileOrder } from "@/features/commerce/actions";
import { displayOrderStatus, paymentStatusLabel } from "@/features/commerce/labels";
import { enrollmentForOrderItem, getAdminOrder } from "@/features/commerce/queries";
import { formatDiscount, formatPrice } from "@/features/courses/format";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  if (!/^CZ-\d{4}-\d{6}$/.test(orderNumber)) notFound();
  const order = await getAdminOrder(orderNumber);
  if (!order) notFound();
  const enrollments = await Promise.all(
    order.items.map(async (item) => ({
      title: item.courseTitleSnapshot,
      enrollment: await enrollmentForOrderItem(order.user.id, item.courseId),
    })),
  );
  const missingEnrollment = order.status === "PAID" && enrollments.some((item) => item.enrollment?.status !== "ACTIVE" && item.enrollment?.status !== "COMPLETED");

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/orders" />
      <p className="mt-8 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Order</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">{order.orderNumber}</h1>
      <p className="mt-2 text-sm" role="status">
        {displayOrderStatus(order)}
        {order.reviewRequired ? " · Needs review" : ""}
      </p>
      {order.reviewRequired ? (
        <p className="mt-4 rounded-xl border border-primary/40 px-4 py-3 text-sm">
          More than one successful payment was reported for this order. Enrollment was not duplicated. Review the attempts below.
        </p>
      ) : null}
      <section className="mt-8">
        <h2 className="text-sm font-medium">Student</h2>
        <p className="mt-2 text-sm">
          <Link href={`/admin/students/${order.user.id}`} className="hover:underline">
            {order.user.name || "Student"}
          </Link>
          <span className="mt-1 block text-muted-foreground">{order.user.email}</span>
        </p>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium">Items</h2>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {order.items.map((item) => (
            <li key={item.courseTitleSnapshot} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {item.courseTitleSnapshot}
                <span className="mt-1 block text-muted-foreground">
                  Snapshot {formatPrice(item.unitPriceCents, order.currency)} · Qty {item.quantity}
                </span>
              </span>
              <span>{formatPrice(item.totalCents, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
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
          <div className="flex justify-between font-medium">
            <dt>Total</dt>
            <dd>{formatPrice(order.totalCents, order.currency)}</dd>
          </div>
        </dl>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium">Enrollment</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {enrollments.map((item) => (
            <li key={item.title}>
              {item.title}: {item.enrollment ? `${item.enrollment.status} · ${item.enrollment.source}` : "Missing"}
            </li>
          ))}
        </ul>
        {missingEnrollment ? (
          <BoundForm action={reconcileOrder} submitLabel="Create missing enrollment" className="mt-4 grid gap-3">
            <input type="hidden" name="orderId" value={order.id} />
          </BoundForm>
        ) : null}
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium">Payment attempts</h2>
        {order.payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No payment attempt yet.</p>
        ) : (
          <ol className="mt-2 space-y-3 text-sm">
            {order.payments.map((payment, index) => (
              <li key={`${payment.createdAt.toISOString()}-${index}`} className="rounded-xl border border-border px-4 py-3">
                <p>
                  Attempt {index + 1}: {paymentStatusLabel(payment.status)} · {formatPrice(payment.amountCents, payment.currency)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {payment.provider === "mock" ? "Development provider" : payment.provider} · {formatDate(payment.createdAt)}
                  {payment.confirmedAt ? ` · Confirmed ${formatDate(payment.confirmedAt)}` : ""}
                </p>
                {payment.providerTransactionId ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Reference {payment.providerTransactionId}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="mt-8 text-xs text-muted-foreground">
        Created {formatDate(order.createdAt)}
        {order.paidAt ? ` · Paid ${formatDate(order.paidAt)}` : ""}
        {order.cancelledAt ? ` · Cancelled ${formatDate(order.cancelledAt)}` : ""}
      </p>
    </main>
  );
}
