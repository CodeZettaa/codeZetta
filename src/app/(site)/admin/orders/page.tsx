import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { displayOrderStatus } from "@/features/commerce/labels";
import { getAdminOrders, parseAdminOrderFilter, type AdminOrderFilter } from "@/features/commerce/queries";
import { formatPrice } from "@/features/courses/format";
import { formatDate } from "@/lib/time";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders" };

const filters: { id: AdminOrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
];

function hrefFor(filter: AdminOrderFilter, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("status", filter);
  const value = params.toString();
  return value ? `/admin/orders?${value}` : "/admin/orders";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status } = await searchParams;
  const filter = parseAdminOrderFilter(status);
  const orders = await getAdminOrders(q, filter);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/orders" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">Orders</h1>
      <p className="mt-2 text-sm text-muted-foreground">Search by order number, student name, or email.</p>
      <form method="get" className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="order-search" className="sr-only">
          Search orders
        </label>
        <input
          id="order-search"
          name="q"
          defaultValue={q}
          placeholder="Order number or student"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        />
        {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
        <button type="submit" className="h-10 rounded-lg border border-border px-4 text-sm">
          Search
        </button>
      </form>
      <div className="mt-4 flex gap-2 overflow-x-auto" role="navigation" aria-label="Order status">
        {filters.map((item) => (
          <Link
            key={item.id}
            href={hrefFor(item.id, q)}
            aria-current={item.id === filter ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground",
              item.id === filter && "bg-muted text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No orders" body="Paid, pending, and failed checkouts will show up here." />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <Link href={`/admin/orders/${order.orderNumber}`} className="grid gap-1 px-4 py-4 text-sm hover:bg-muted/40 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-3">
                <span className="font-mono">{order.orderNumber}</span>
                <span className="truncate">{order.user.name || order.user.email}</span>
                <span className="truncate">{order.items.map((item) => item.courseTitleSnapshot).join(", ")}</span>
                <span>{formatPrice(order.totalCents, order.currency)}</span>
                <span className="text-muted-foreground">
                  {displayOrderStatus(order)}
                  {order.reviewRequired ? " · Needs review" : ""} · {formatDate(order.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
