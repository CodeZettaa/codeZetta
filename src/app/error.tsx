"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col px-5 py-24">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Error</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Something failed while loading this page.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        If the database is not running, start Postgres and try again.
      </p>
      <Button type="button" className="mt-8 h-10 w-fit px-4" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
