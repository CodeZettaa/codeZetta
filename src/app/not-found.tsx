import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "cn";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-24">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">404</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">This page is not in the catalog.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The course may be unpublished, or the address is wrong.
      </p>
      <Link href="/courses" className={cn(buttonVariants(), "mt-8 h-10 w-fit px-4")}>
        Back to courses
      </Link>
    </main>
    </>
  );
}
