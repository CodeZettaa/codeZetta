"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function PaymentPoller({ active }: { active: boolean }) {
  const router = useRouter();
  const checks = useRef(0);

  useEffect(() => {
    if (!active || checks.current >= 8) return;
    const timer = setTimeout(() => {
      checks.current += 1;
      router.refresh();
    }, 3000);
    return () => clearTimeout(timer);
  }, [active, router]);

  return null;
}

export function CheckAgain() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
      Check again
    </button>
  );
}
