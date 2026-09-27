import type { Course } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThumbnailField } from "@/features/admin/components/thumbnail-field";
import { formatPrice } from "@/features/courses/format";

const control =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function CourseFields({
  course,
  panel = "details",
}: {
  course?: Course;
  panel?: "details" | "pricing" | "settings" | "all";
}) {
  const price = course ? course.priceCents / 100 : 0;
  const compare = course?.originalPriceCents ? course.originalPriceCents / 100 : 0;
  const discount = compare > price && compare > 0 ? Math.round((1 - price / compare) * 100) : 0;

  return (
    <div className="grid gap-4">
      <input type="hidden" name="status" value={course?.status ?? "DRAFT"} />
      <div hidden={panel !== "all" && panel !== "details"} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={course?.title} className="h-10" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" name="slug" defaultValue={course?.slug} className="h-10" placeholder="angular-signals" />
          {course?.status === "PUBLISHED" ? (
            <p className="text-xs text-muted-foreground">Changing this URL may break existing links.</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            defaultValue={course?.description}
            className={control}
          />
        </div>
        <ThumbnailField initial={course?.thumbnail ?? ""} />
      </div>

      <div hidden={panel !== "all" && panel !== "pricing"} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="currency">Currency</Label>
          <select id="currency" name="currency" defaultValue={course?.currency ?? "USD"} className={control}>
            <option value="USD">USD</option>
            <option value="EGP">EGP</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={course ? String(course.priceCents / 100) : "0"}
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="originalPrice">Compare-at price</Label>
          <Input
            id="originalPrice"
            name="originalPrice"
            inputMode="decimal"
            defaultValue={course?.originalPriceCents ? String(course.originalPriceCents / 100) : ""}
            className="h-10"
          />
        </div>
        {course && compare > price ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {formatPrice(course.priceCents, course.currency)}{" "}
            <span className="line-through">{formatPrice(course.originalPriceCents ?? 0, course.currency)}</span>
            {discount > 0 ? ` · ${discount}% off` : ""}
          </p>
        ) : null}
      </div>

      <div hidden={panel !== "all" && panel !== "settings"} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="level">Level</Label>
          <select id="level" name="level" defaultValue={course?.level ?? "INTERMEDIATE"} className={control}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="technologies">Technologies</Label>
          <Input
            id="technologies"
            name="technologies"
            defaultValue={course?.technologies.join(", ")}
            className="h-10"
            placeholder="Angular, TypeScript"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="outcomes">What students learn</Label>
          <textarea
            id="outcomes"
            name="outcomes"
            rows={5}
            defaultValue={course?.outcomes.join("\n")}
            className={control}
            placeholder="One outcome per line"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="requirements">Requirements</Label>
          <textarea
            id="requirements"
            name="requirements"
            rows={4}
            defaultValue={course?.requirements.join("\n")}
            className={control}
            placeholder="One requirement per line"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="featured" defaultChecked={course?.featured} className="size-4 accent-[var(--primary)]" />
          Featured on the homepage
        </label>
      </div>
    </div>
  );
}

export { control as fieldControl };
