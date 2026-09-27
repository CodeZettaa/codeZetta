import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function FinalCta({ continueHref }: { continueHref: string | null }) {
  return (
    <section className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-20 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <h2 className="max-w-lg text-3xl font-medium tracking-tight">
            Start with the system. The syntax will follow.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Browse the catalog, or go back to the lesson you already started.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/courses" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
            Explore courses
          </Link>
          <Link
            href={continueHref ?? "/register"}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
          >
            {continueHref ? "Continue learning" : "Start learning"}
          </Link>
        </div>
      </div>
    </section>
  );
}
