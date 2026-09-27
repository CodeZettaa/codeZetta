"use client";

import { Button } from "@/components/ui/button";

export default function LearnError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-5 py-20">
      <h1 className="text-3xl font-medium tracking-tight">This lesson couldn&apos;t be opened.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Your place in the course is still saved. Try again in a moment.
      </p>
      <Button type="button" className="mt-6 h-11 w-fit px-4" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
