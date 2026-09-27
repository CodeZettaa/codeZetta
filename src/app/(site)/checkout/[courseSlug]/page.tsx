import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { CheckoutPayForm, CouponForm, FreeEnrollForm } from "@/features/commerce/components/checkout-forms";
import { prepareCheckout } from "@/features/commerce/service";
import { formatDiscount, formatPrice, splitCourseTitle } from "@/features/courses/format";
import { requireUser } from "@/server/authz";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const user = await requireUser();
  const checkout = await prepareCheckout(user.id, courseSlug);
  if (checkout.kind === "missing") notFound();
  const { course } = checkout;
  const title = splitCourseTitle(course.title);
  const price = formatPrice(checkout.kind === "ready" ? checkout.order.totalCents : course.priceCents, course.currency);

  return (
    <main className="mx-auto w-full max-w-md px-5 py-12 md:py-16">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Checkout</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">{title.name}</h1>
      {title.subtitle ? <p className="mt-2 text-sm text-muted-foreground">{title.subtitle}</p> : null}

      {checkout.kind === "owned" ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium">You already own this course.</p>
          <Link href={`/courses/${course.slug}`} className={cn(buttonVariants({ size: "lg" }), "mt-5 h-11 w-full")}>
            Continue learning
          </Link>
        </div>
      ) : null}

      {checkout.kind === "unavailable" ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Payments aren&apos;t available right now. An instructor can enroll you.
          </p>
          <Link href={`/courses/${course.slug}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-5 h-11 w-full")}>
            Back to course
          </Link>
        </div>
      ) : null}

      {checkout.kind === "free" ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Course price</p>
          <p className="mt-1 text-2xl font-medium">{price}</p>
          <div className="mt-6">
            <FreeEnrollForm courseSlug={course.slug} />
          </div>
        </section>
      ) : null}

      {checkout.kind === "ready" ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          {checkout.notice ? (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {checkout.notice}
            </p>
          ) : null}
          {checkout.order.promotionNameSnapshot ? (
            <p className="text-sm text-primary">{checkout.order.promotionNameSnapshot}</p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">Course price</p>
          <p className="mt-1 text-2xl font-medium">{formatPrice(checkout.order.subtotalCents, checkout.order.currency)}</p>
          <div className="mt-5">
            <CouponForm courseSlug={course.slug} appliedCode={checkout.order.couponCodeSnapshot} />
          </div>
          <dl className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(checkout.order.subtotalCents, checkout.order.currency)}</dd>
            </div>
            {checkout.order.discountCents > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Discount
                  {checkout.order.couponCodeSnapshot ? ` · ${checkout.order.couponCodeSnapshot}` : ""}
                </dt>
                <dd>{formatDiscount(checkout.order.discountCents, checkout.order.currency)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between pt-2">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-2xl font-medium">
                {checkout.order.totalCents === 0
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: checkout.order.currency,
                      maximumFractionDigits: 0,
                    }).format(0)
                  : formatPrice(checkout.order.totalCents, checkout.order.currency)}
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <CheckoutPayForm
              courseSlug={course.slug}
              label={checkout.order.totalCents === 0 ? "Complete enrollment" : "Continue to payment"}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {checkout.order.totalCents === 0
              ? "This order is fully discounted. No payment provider is used."
              : "Secure payment. Returning from the provider does not complete the order by itself."}
          </p>
        </section>
      ) : null}
    </main>
  );
}
