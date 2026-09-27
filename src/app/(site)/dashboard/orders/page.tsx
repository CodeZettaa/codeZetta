import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { displayOrderStatus } from "@/features/commerce/labels";
import { getStudentOrders } from "@/features/commerce/queries";
import { formatPrice } from "@/features/courses/format";
import { formatDate } from "@/lib/time";
import { requireUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getStudentOrders(user.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Dashboard</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">Orders</h1>
      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No orders yet" body="When you buy a course, the receipt shows up here." actionHref="/courses" actionLabel="Browse courses" />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <Link href={`/dashboard/orders/${order.orderNumber}`} className="grid gap-1 px-4 py-4 hover:bg-muted/40 sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                <span className="font-mono text-sm">{order.orderNumber}</span>
                <span className="truncate text-sm">{order.items.map((item) => item.courseTitleSnapshot).join(", ")}</span>
                <span className="text-sm">{formatPrice(order.totalCents, order.currency)}</span>
                <span className="text-sm text-muted-foreground">
                  {displayOrderStatus(order)} · {formatDate(order.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
