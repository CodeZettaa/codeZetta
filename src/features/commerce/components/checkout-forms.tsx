"use client";

import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { applyCoupon, continueToPayment, enrollInFreeCourse, removeCoupon } from "@/features/commerce/actions";
import { cn } from "cn";

export function CheckoutPayForm({ courseSlug, label = "Continue to payment" }: { courseSlug: string; label?: string }) {
  const [error, action, pending] = useActionState(continueToPayment, null);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="courseSlug" value={courseSlug} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
        {pending ? "Redirecting to payment…" : label}
      </button>
    </form>
  );
}

export function CouponForm({ courseSlug, appliedCode }: { courseSlug: string; appliedCode: string | null }) {
  const [error, action, pending] = useActionState(appliedCode ? removeCoupon : applyCoupon, null);

  if (appliedCode) {
    return (
      <form action={action} className="grid gap-2">
        <input type="hidden" name="courseSlug" value={courseSlug} />
        <p className="text-sm" role="status">
          {appliedCode} applied
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline">
          {pending ? "Removing…" : "Remove coupon"}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <label htmlFor="coupon-code" className="text-sm text-muted-foreground">
        Coupon code
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm uppercase"
        />
        <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: "outline" }), "h-11 shrink-0")}>
          {pending ? "Checking…" : "Apply"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function FreeEnrollForm({ courseSlug }: { courseSlug: string }) {
  const [error, action, pending] = useActionState(enrollInFreeCourse, null);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="courseSlug" value={courseSlug} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
        {pending ? "Enrolling…" : "Enroll for free"}
      </button>
    </form>
  );
}
