"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-20">
      <h1 className="text-3xl font-medium tracking-tight">The dashboard could not be loaded.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Your courses are still saved. Try again in a moment.
      </p>
      <Button type="button" className="mt-6 h-10 px-4" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
