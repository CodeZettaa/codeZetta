"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlaybackProgress } from "@/features/learning/actions";

const SAVE_EVERY_MS = 15_000;
const MAX_ATTEMPTS = 3;

type Sample = {
  positionSeconds: number;
  playedSeconds: number;
  seek: boolean;
  reset: boolean;
  observedAt: number;
};

export function usePlaybackSync(lessonId: string, enabled: boolean) {
  const router = useRouter();
  const lastSent = useRef(0);
  const refreshed = useRef(false);
  const queued = useRef<Sample | null>(null);
  const sending = useRef(false);
  const failures = useRef(0);
  const lessonRef = useRef(lessonId);
  const enabledRef = useRef(enabled);
  const pumpRef = useRef<() => void>(() => {});
  const [warning, setWarning] = useState<string | null>(null);

  const pump = useCallback(async () => {
    if (sending.current || !queued.current || !enabledRef.current) return;
    const sample = queued.current;
    queued.current = null;
    sending.current = true;
    let attempt = 0;
    let saved = false;
    while (attempt < MAX_ATTEMPTS && !saved) {
      attempt += 1;
      try {
        const result = await updatePlaybackProgress({
          lessonId: lessonRef.current,
          positionSeconds: sample.positionSeconds,
          playedSeconds: sample.playedSeconds,
          seek: sample.seek,
          reset: sample.reset,
          observedAt: sample.observedAt,
        });
        if (result.ok) {
          saved = true;
          failures.current = 0;
          setWarning(null);
          if (result.justCompleted && !refreshed.current) {
            refreshed.current = true;
            router.refresh();
          }
        } else if (result.code === "forbidden" || result.code === "unauthorized") {
          sending.current = false;
          router.refresh();
          return;
        }
      } catch {
        // The next attempt, or the next tick, carries the newest sample.
      }
    }
    sending.current = false;
    if (!saved) {
      failures.current += 1;
      const pending = queued.current as Sample | null;
      if (pending) {
        queued.current = {
          ...pending,
          playedSeconds: pending.playedSeconds + sample.playedSeconds,
        };
      } else if (failures.current < MAX_ATTEMPTS) {
        queued.current = sample;
      }
      if (failures.current >= 2) {
        setWarning("We're having trouble saving your progress.");
      }
    }
    if (queued.current) void pumpRef.current();
  }, [router]);

  useEffect(() => {
    lessonRef.current = lessonId;
    enabledRef.current = enabled;
    pumpRef.current = pump;
  });

  const report = useCallback(
    (seconds: number, playedSeconds: number, options?: { flush?: boolean; seek?: boolean; reset?: boolean }) => {
      if (!enabledRef.current) return;
      const reset = Boolean(options?.reset);
      if (!reset && seconds <= 0 && playedSeconds <= 0) return;
      const now = Date.now();
      const flush = Boolean(options?.flush || options?.seek || reset);
      if (!flush && now - lastSent.current < SAVE_EVERY_MS) {
        const pending = queued.current;
        queued.current = {
          positionSeconds: Math.floor(seconds),
          playedSeconds: (pending?.playedSeconds ?? 0) + playedSeconds,
          seek: Boolean(pending?.seek || options?.seek),
          reset: false,
          observedAt: pending?.observedAt ?? now,
        };
        return;
      }
      lastSent.current = now;
      const sample: Sample = {
        positionSeconds: reset ? 0 : Math.floor(seconds),
        playedSeconds: Math.max(0, playedSeconds),
        seek: Boolean(options?.seek || reset),
        reset,
        observedAt: now,
      };
      if (queued.current && !reset) {
        sample.playedSeconds += queued.current.playedSeconds;
        sample.seek = sample.seek || queued.current.seek;
      }
      queued.current = sample;
      void pump();
    },
    [pump],
  );

  const retry = useCallback(() => {
    failures.current = 0;
    setWarning(null);
    void pump();
  }, [pump]);

  return { report, warning, retry };
}
