"use client";

export function ProgressWarning({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p role="status" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{message}</span>
      <button type="button" className="inline-flex h-11 items-center text-primary" onClick={onRetry}>
        Retry
      </button>
    </p>
  );
}
