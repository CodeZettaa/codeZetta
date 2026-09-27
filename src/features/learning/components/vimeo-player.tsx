"use client";

import { useEffect, useRef } from "react";
import { ProgressWarning } from "@/features/learning/components/progress-warning";
import { usePlaybackSync } from "@/features/learning/components/playback-sync";
import { RESUME_SEEK_SECONDS } from "@/features/learning/progress";

const ORIGIN = "https://player.vimeo.com";

export function VimeoPlayer({
  lessonId,
  src,
  startSeconds,
  trackProgress,
  resetOnMount = false,
}: {
  lessonId: string;
  src: string;
  startSeconds: number;
  trackProgress: boolean;
  resetOnMount?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { report, warning, retry } = usePlaybackSync(lessonId, trackProgress);
  const reportRef = useRef(report);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const start = resetOnMount || startSeconds < RESUME_SEEK_SECONDS ? 0 : Math.floor(startSeconds);
    let last = start;
    let played = 0;

    const post = (payload: unknown) => {
      iframe.contentWindow?.postMessage(JSON.stringify(payload), ORIGIN);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== ORIGIN || !trackProgress) return;
      const payload = typeof event.data === "string" ? safeJson(event.data) : event.data;
      if (!payload || typeof payload !== "object") return;
      const message = payload as { event?: string; data?: { seconds?: number } };
      if (message.event === "ready") {
        post({ method: "addEventListener", value: "timeupdate" });
        post({ method: "addEventListener", value: "pause" });
        post({ method: "addEventListener", value: "ended" });
        if (start > 0) post({ method: "setCurrentTime", value: start });
        if (resetOnMount) reportRef.current(0, 0, { flush: true, reset: true, seek: true });
        return;
      }
      const seconds = message.data?.seconds;
      if (typeof seconds !== "number") return;
      const delta = seconds - last;
      if (delta > 0 && delta <= 1.5) played += delta;
      const seek = delta < -2 || delta > 1.5;
      last = seconds;
      const chunk = played;
      played = 0;
      const flush = message.event === "pause" || message.event === "ended";
      if (flush || seek || chunk > 0) reportRef.current(seconds, chunk, { flush, seek });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resetOnMount, src, startSeconds, trackProgress]);

  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <iframe
          ref={iframeRef}
          title="Lesson video"
          src={src}
          className="size-full"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
      {warning ? <ProgressWarning message={warning} onRetry={retry} /> : null}
    </div>
  );
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
