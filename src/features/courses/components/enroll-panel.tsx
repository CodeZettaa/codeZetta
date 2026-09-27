import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BoundForm } from "@/features/admin/components/bound-form";
import { FreeEnrollForm } from "@/features/commerce/components/checkout-forms";
import { OfferCountdown } from "@/features/commerce/components/offer-countdown";
import { enrollSelf } from "@/features/enrollment/actions";
import type { CourseCallToAction } from "@/features/enrollment/access";
import { formatDuration, formatLevel, formatPrice, lessonCount } from "@/features/courses/format";
import type { CourseDetail } from "@/features/courses/queries";
import { cn } from "cn";

export function EnrollPanel({
  course,
  access,
  price,
}: {
  course: CourseDetail;
  access: CourseCallToAction;
  price?: {
    totalCents: number;
    discountCents: number;
    offerName: string | null;
    endsAt: string | null;
  };
}) {
  const lessons = lessonCount(course.modules);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {formatLevel(course.level)}
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-3">
        {price && price.discountCents > 0 ? (
          <span className="text-sm text-muted-foreground line-through">
            {formatPrice(course.priceCents, course.currency)}
          </span>
        ) : null}
        <span className="text-3xl font-medium tracking-tight">
          {formatPrice(price?.totalCents ?? course.priceCents, course.currency)}
        </span>
        {!price?.discountCents && course.originalPriceCents && course.originalPriceCents > course.priceCents ? (
          <span className="text-sm text-muted-foreground line-through">
            {formatPrice(course.originalPriceCents, course.currency)}
          </span>
        ) : null}
      </p>
      {price?.offerName ? (
        <p className="mt-2 text-sm text-primary">
          {price.offerName}
          {price.endsAt ? <OfferCountdown endsAt={price.endsAt} /> : null}
        </p>
      ) : null}
      <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
        <li>{formatDuration(course.durationSeconds)}</li>
        <li>
          {course.modules.length} modules · {lessons} lessons
        </li>
        <li>
          {course.projects.length} {course.projects.length === 1 ? "project" : "projects"}
        </li>
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        {access.kind === "visitor" ? (
          <>
            <Link href={access.href} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
              Sign in to enroll
            </Link>
            <Link href={access.registerHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              Create account
            </Link>
          </>
        ) : null}
        {access.kind === "buy" ? (
          <Link href={access.href} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
            Buy course — {formatPrice(price?.totalCents ?? course.priceCents, course.currency)}
          </Link>
        ) : null}
        {access.kind === "resume" ? (
          <Link href={access.href} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
            Complete payment
          </Link>
        ) : null}
        {access.kind === "free" ? <FreeEnrollForm courseSlug={access.courseSlug} /> : null}
        {access.kind === "enroll" && access.devEnrollment ? (
          <>
            <BoundForm action={enrollSelf} submitLabel="Enroll" className="grid gap-3">
              <input type="hidden" name="courseId" value={course.id} />
            </BoundForm>
            <p className="text-xs leading-5 text-muted-foreground">
              Development enrollment is on. This grants access only on this machine.
            </p>
          </>
        ) : null}
        {access.kind === "enroll" && !access.devEnrollment ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Payments aren&apos;t available right now. An instructor can enroll you.
          </p>
        ) : null}
        {access.kind === "start" ? (
          <Link href={access.href} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
            Start course
          </Link>
        ) : null}
        {access.kind === "continue" ? (
          <Link href={access.href} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
            Continue learning
          </Link>
        ) : null}
        {access.kind === "completed" ? (
          <>
            <p className="text-sm font-medium text-primary">Course completed</p>
            <Link href={access.href} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              Review course
            </Link>
          </>
        ) : null}
        {access.kind === "instructor" ? (
          <>
            <Link href={access.href} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
              Preview course
            </Link>
            <Link href={access.editHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              Edit course
            </Link>
            <p className="text-sm leading-6 text-muted-foreground">
              Instructor access. Student enrollment isn&apos;t shown here.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
