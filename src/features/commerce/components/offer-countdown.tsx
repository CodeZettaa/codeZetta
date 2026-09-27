"use client";

import { useEffect, useState } from "react";

export function OfferCountdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const remaining = new Date(endsAt).getTime() - Date.now();
      if (remaining <= 0) {
        setLabel("This offer has ended.");
        return;
      }
      const days = Math.floor(remaining / 86_400_000);
      const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
      const minutes = Math.floor((remaining % 3_600_000) / 60_000);
      setLabel(days > 0 ? `Ends in ${days}d ${hours}h` : `Ends in ${hours}h ${minutes}m`);
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!label) return null;
  return <span className="mt-1 block text-sm text-muted-foreground">{label}</span>;
}
