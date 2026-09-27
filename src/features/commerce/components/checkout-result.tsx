import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { CheckAgain, PaymentPoller } from "@/features/commerce/components/payment-poller";
import { displayOrderStatus } from "@/features/commerce/labels";
import { getStudentOrder } from "@/features/commerce/queries";
import { formatPrice, splitCourseTitle } from "@/features/courses/format";
import { requireUser } from "@/server/authz";
import { cn } from "cn";

function isOrderNumber(value: string) {
  return /^CZ-\d{4}-\d{6}$/.test(value);
}

export async function CheckoutResult({ orderNumber }: { orderNumber: string }) {
  const user = await requireUser();
  if (!isOrderNumber(orderNumber)) notFound();
  const order = await getStudentOrder(user.id, orderNumber);
  if (!order) notFound();
  const item = order.items[0];
  const title = item ? splitCourseTitle(item.courseTitleSnapshot) : null;
  const waiting = order.status === "PENDING" || order.status === "PAYMENT_PENDING";
  const paid = order.status === "PAID";
  const courseHref = item ? `/courses/${item.course.slug}` : "/dashboard";

  return (
    <main className="mx-auto w-full max-w-md px-5 py-12 md:py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Checkout</p>
      <PaymentPoller active={waiting} />
      {waiting ? (
        <>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Confirming your payment…</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground" role="status">
            We&apos;re confirming your enrollment. This usually takes a moment.
          </p>
          <div className="mt-6">
            <CheckAgain />
          </div>
        </>
      ) : null}
      {paid ? (
        <>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Payment confirmed</h1>
          <p className="mt-3 text-sm leading-6" role="status">
            You&apos;re enrolled. {title?.name ?? "Your course"} is ready.
          </p>
          <Link href={courseHref} className={cn(buttonVariants({ size: "lg" }), "mt-6 h-11 w-full")}>
            Start learning
          </Link>
        </>
      ) : null}
      {!waiting && !paid ? (
        <>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Payment unsuccessful</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground" role="status">
            Your payment wasn&apos;t completed. Status: {displayOrderStatus(order)}.
          </p>
          <div className="mt-6 grid gap-2">
            {item ? (
              <Link href={`/checkout/${item.course.slug}`} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
                Try again
              </Link>
            ) : null}
            <Link href={courseHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              Back to course
            </Link>
          </div>
        </>
      ) : null}
      {item ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {order.orderNumber} · {formatPrice(order.totalCents, order.currency)}
        </p>
      ) : null}
    </main>
  );
}
