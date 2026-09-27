"use client";

import { useId, useRef, useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function ConfirmDialog({
  triggerLabel,
  title,
  body,
  confirmLabel,
  cancelLabel,
  action,
  triggerClassName,
}: {
  triggerLabel: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  action: () => Promise<void>;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={cn(
          "rounded-md text-sm text-destructive underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          triggerClassName,
        )}
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(calc(100%-2rem),26rem)] rounded-2xl border border-border bg-card p-6 text-foreground backdrop:bg-black/70"
      >
        <h2 id={titleId} className="text-lg font-medium tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "h-11")}
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "destructive" }), "h-11")}
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await action();
                  dialogRef.current?.close();
                } catch {
                  setError("We couldn't update that enrollment. Please try again.");
                }
              });
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
