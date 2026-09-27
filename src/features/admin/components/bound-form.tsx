"use client";

import { useActionState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function BoundForm({
  action,
  children,
  className,
  submitLabel,
}: {
  action: (state: string | null, formData: FormData) => Promise<string | null>;
  children: ReactNode;
  className?: string;
  submitLabel: string;
}) {
  const [error, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants(), "h-11 w-fit px-4")}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
