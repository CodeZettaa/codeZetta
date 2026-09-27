"use client";

import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { simulateMockOutcome } from "@/features/commerce/actions";
import { cn } from "cn";

export function MockOutcomeForm({ attemptId }: { attemptId: string }) {
  const [error, action, pending] = useActionState(simulateMockOutcome, null);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="attemptId" value={attemptId} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        name="outcome"
        value="succeeded"
        disabled={pending}
        className={cn(buttonVariants({ size: "lg" }), "h-11")}
      >
        {pending ? "Sending…" : "Simulate successful payment"}
      </button>
      <button
        type="submit"
        name="outcome"
        value="failed"
        disabled={pending}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
      >
        Simulate failed payment
      </button>
      <button
        type="submit"
        name="outcome"
        value="cancelled"
        disabled={pending}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
      >
        Simulate cancelled payment
      </button>
    </form>
  );
}
