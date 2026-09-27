import { BoundForm } from "@/features/admin/components/bound-form";
import { fieldControl } from "@/features/admin/components/course-fields";
import { saveCoupon, savePromotion } from "@/features/commerce/offer-admin";
import { calculatePrice, utcDateTimeLocal } from "@/features/commerce/pricing";
import { formatPrice } from "@/features/courses/format";

type CourseOption = { id: string; title: string; priceCents: number; currency: string };

export function OfferFields({
  kind,
  courses,
  initial,
}: {
  kind: "coupon" | "promotion";
  courses: CourseOption[];
  initial?: {
    id: string;
    name?: string;
    code?: string;
    description?: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    currency: string | null;
    status: "DRAFT" | "ACTIVE" | "INACTIVE";
    startsAt: Date | null;
    endsAt: Date | null;
    appliesToAll: boolean;
    courseIds: string[];
    maxRedemptions?: number | null;
    maxRedemptionsPerUser?: number;
    minimumOrderCents?: number;
  };
}) {
  const selected = new Set(initial?.courseIds ?? []);
  const action = kind === "coupon" ? saveCoupon : savePromotion;
  const previewCourses = initial
    ? courses.filter((course) => initial.appliesToAll || selected.has(course.id)).slice(0, 6)
    : [];

  return (
    <BoundForm action={action} submitLabel={initial ? "Save" : "Create"} className="mt-8 grid gap-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {kind === "coupon" ? (
        <>
          <label className="grid gap-1 text-sm">
            Code
            <input name="code" required defaultValue={initial?.code ?? ""} className={fieldControl} autoCapitalize="characters" />
          </label>
          <label className="grid gap-1 text-sm">
            Description
            <input name="description" defaultValue={initial?.description ?? ""} className={fieldControl} />
          </label>
        </>
      ) : (
        <label className="grid gap-1 text-sm">
          Name
          <input name="name" required defaultValue={initial?.name ?? ""} className={fieldControl} />
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Discount type
          <select name="discountType" defaultValue={initial?.discountType ?? "PERCENTAGE"} className={fieldControl}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Discount value
          <input
            name="discountValue"
            required
            defaultValue={
              initial ? (initial.discountType === "PERCENTAGE" ? String(initial.discountValue) : String(initial.discountValue / 100)) : ""
            }
            className={fieldControl}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Currency for a fixed discount
        <select name="currency" defaultValue={initial?.currency ?? "EGP"} className={fieldControl}>
          <option value="EGP">EGP</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm">Applies to</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="appliesTo" value="all" defaultChecked={initial?.appliesToAll ?? kind === "coupon"} />
          All courses
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="appliesTo" value="selected" defaultChecked={initial ? !initial.appliesToAll : kind === "promotion"} />
          Selected courses
        </label>
        <div className="mt-2 grid max-h-48 gap-1 overflow-auto rounded-lg border border-border p-3">
          {courses.map((course) => (
            <label key={course.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="courseIds" value={course.id} defaultChecked={selected.has(course.id)} />
              {course.title}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          {kind === "coupon" ? "Starts (UTC)" : "Starts (UTC)"}
          <input type="datetime-local" name="startsAt" required={kind === "promotion"} defaultValue={initial?.startsAt ? utcDateTimeLocal(initial.startsAt) : ""} className={fieldControl} />
        </label>
        <label className="grid gap-1 text-sm">
          {kind === "coupon" ? "Expires (UTC)" : "Ends (UTC)"}
          <input
            type="datetime-local"
            name={kind === "coupon" ? "expiresAt" : "endsAt"}
            required={kind === "promotion"}
            defaultValue={initial?.endsAt ? utcDateTimeLocal(initial.endsAt) : ""}
            className={fieldControl}
          />
        </label>
      </div>
      {kind === "coupon" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Maximum uses
            <input name="maxRedemptions" defaultValue={initial?.maxRedemptions ?? ""} className={fieldControl} />
          </label>
          <label className="grid gap-1 text-sm">
            Uses per student
            <input name="maxRedemptionsPerUser" defaultValue={initial?.maxRedemptionsPerUser ?? 1} className={fieldControl} />
          </label>
          <label className="grid gap-1 text-sm">
            Minimum order
            <input name="minimumOrder" defaultValue={initial?.minimumOrderCents ? initial.minimumOrderCents / 100 : ""} className={fieldControl} />
          </label>
        </div>
      ) : null}
      <label className="grid gap-1 text-sm">
        Status
        <select name="status" defaultValue={initial?.status ?? "DRAFT"} className={fieldControl}>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </label>
      {initial && previewCourses.length > 0 ? (
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">Pricing preview</p>
          <ul className="mt-2 space-y-2">
            {previewCourses.map((course) => {
              const quote = calculatePrice({
                title: course.title,
                priceCents: course.priceCents,
                currency: course.currency,
                now: kind === "promotion" && initial.startsAt ? initial.startsAt : new Date(),
                promotions:
                  kind === "promotion" && initial.startsAt && initial.endsAt
                    ? [
                        {
                          id: initial.id,
                          name: initial.name ?? "Offer",
                          status: "ACTIVE",
                          discountType: initial.discountType,
                          discountValue: initial.discountValue,
                          currency: initial.currency,
                          startsAt: initial.startsAt,
                          endsAt: initial.endsAt,
                          applies: true,
                        },
                      ]
                    : [],
                coupon:
                  kind === "coupon"
                    ? {
                        id: initial.id,
                        code: initial.code ?? "",
                        status: "ACTIVE",
                        discountType: initial.discountType,
                        discountValue: initial.discountValue,
                        currency: initial.currency,
                        startsAt: null,
                        expiresAt: null,
                        applies: true,
                        minimumOrderCents: initial.minimumOrderCents ?? 0,
                        maxRedemptions: null,
                        redemptionCount: 0,
                        maxRedemptionsPerUser: 1,
                        userRedemptionCount: 0,
                      }
                    : null,
              });
              return (
                <li key={course.id}>
                  {course.title}: {formatPrice(course.priceCents, course.currency)} → {formatPrice(quote.totalCents, course.currency)}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-muted-foreground">The course price stays unchanged. This offer applies only while it is active.</p>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Times are UTC. Students are charged the server price at payment, not the price shown when they opened the page.
      </p>
    </BoundForm>
  );
}
