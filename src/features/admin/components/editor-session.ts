"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function storageKey(courseId: string) {
  return `cz-builder:${courseId}`;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function read(courseId: string) {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(storageKey(courseId)) ?? "";
}

export function useBuilderSession(courseId: string) {
  const raw = useSyncExternalStore(subscribe, () => read(courseId), () => "");
  const [storedTab = "", storedClosed = ""] = raw.split("|");
  const tab = storedTab || "content";
  const closed = new Set(storedClosed.split(",").filter(Boolean));

  function update(next: { tab?: string; closed?: Set<string> }) {
    const nextTab = next.tab ?? tab;
    const nextClosed = next.closed ?? closed;
    sessionStorage.setItem(storageKey(courseId), `${nextTab}|${[...nextClosed].join(",")}`);
    emit();
  }

  return { tab, closed, update };
}
