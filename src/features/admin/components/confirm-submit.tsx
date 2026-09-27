"use client";

import { useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function ConfirmSubmit({
  action,
  label,
  confirm,
  variant = "ghost",
}: {
  action: () => Promise<void>;
  label: string;
  confirm: string;
  variant?: "ghost" | "destructive";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={cn(
          buttonVariants({ variant: variant === "destructive" ? "destructive" : "ghost", size: "sm" }),
          "h-8 px-2",
        )}
        onClick={() => {
          if (!window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            try {
              await action();
            } catch {
              setError("Could not complete that action.");
            }
          });
        }}
      >
        {label}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </>
  );
}
