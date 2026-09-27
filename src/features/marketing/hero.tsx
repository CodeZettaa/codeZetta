import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function Hero({ continueHref }: { continueHref: string | null }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,oklch(0.84_0.13_85/0.12),transparent_60%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.22em] text-primary uppercase">CodeZetta</p>
          <h1 className="mt-4 max-w-xl text-4xl font-medium tracking-tight text-balance md:text-6xl md:leading-[1.02]">
            Don&apos;t just learn the syntax. Understand the engineering.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
            Advanced software engineering education for people who already write code. Real projects,
            the decisions underneath them, and a place to pick the work back up.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
        <aside aria-hidden className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted-foreground">signals.ts</p>
            <p className="font-mono text-xs text-primary">dependency graph</p>
          </div>
          <pre className="mt-5 overflow-x-auto font-mono text-[13px] leading-7 text-foreground/90">
            {`const query = signal("")
const visible = computed(() =>
  items().filter((item) =>
    item.includes(query())
  )
)

effect(() => render(visible()))`}
          </pre>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
            <span>query → visible</span>
            <span>items → visible</span>
            <span>visible → view</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
