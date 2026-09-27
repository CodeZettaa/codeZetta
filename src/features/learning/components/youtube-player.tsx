"use client";

import { useEffect, useRef, useState } from "react";
import { usePlaybackSync } from "@/features/learning/components/playback-sync";
import { ProgressWarning } from "@/features/learning/components/progress-warning";
import { RESUME_SEEK_SECONDS } from "@/features/learning/progress";

type Player = {
  getCurrentTime?: () => number;
  getPlayerState?: () => number;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  destroy?: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: Player }) => void;
            onStateChange?: (event: { data: number; target: Player }) => void;
            onError?: () => void;
          };
        },
      ) => Player;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function YouTubePlayer({
  lessonId,
  videoId,
  startSeconds,
  trackProgress,
  resetOnMount = false,
}: {
  lessonId: string;
  videoId: string;
  startSeconds: number;
  trackProgress: boolean;
  resetOnMount?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { report, warning, retry } = usePlaybackSync(lessonId, trackProgress);
  const reportRef = useRef(report);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !videoId) return;
    let player: Player | null = null;
    let poll = 0;
    let cancelled = false;
    let playingSince = 0;
    let played = 0;
    const start = resetOnMount || startSeconds < RESUME_SEEK_SECONDS ? 0 : Math.floor(startSeconds);
    let lastPosition = start;

    const collectPlayed = () => {
      if (playingSince) {
        played += (performance.now() - playingSince) / 1000;
        playingSince = 0;
      }
      const seconds = played;
      played = 0;
      return seconds;
    };

    const publish = (flush: boolean) => {
      const time = player?.getCurrentTime?.();
      if (typeof time !== "number" || Number.isNaN(time)) return;
      const pending = playingSince ? (performance.now() - playingSince) / 1000 + played : played;
      const jumped = time + 2 < lastPosition || time > lastPosition + pending + 3;
      if (playingSince) {
        played += (performance.now() - playingSince) / 1000;
        playingSince = performance.now();
      }
      const playedSeconds = played;
      played = 0;
      lastPosition = time;
      reportRef.current(time, playedSeconds, { flush: flush || jumped, seek: jumped });
    };

    const mount = () => {
      if (cancelled || !window.YT?.Player || !hostRef.current) return;
      player = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          start,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (start > 0) event.target.seekTo?.(start, true);
            if (resetOnMount) reportRef.current(0, 0, { flush: true, reset: true, seek: true });
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              if (!playingSince) playingSince = performance.now();
              return;
            }
            if (playingSince) {
              played += (performance.now() - playingSince) / 1000;
              playingSince = 0;
            }
            if (event.data === 2 || event.data === 0) publish(true);
          },
          onError: () => {
            if (!cancelled) setFailed(true);
          },
        },
      });
      poll = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        if (player?.getPlayerState?.() !== 1) return;
        publish(false);
      }, 15_000);
    };

    if (window.YT?.Player) {
      mount();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        mount();
      };
      if (!document.querySelector("script[data-youtube-iframe-api]")) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.dataset.youtubeIframeApi = "true";
        script.onerror = () => {
          if (!cancelled) setFailed(true);
        };
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      const time = player?.getCurrentTime?.() ?? lastPosition;
      const playedSeconds = collectPlayed();
      if (playedSeconds > 0 || time > 0) reportRef.current(time, playedSeconds, { flush: true });
      player?.destroy?.();
    };
  }, [attempt, lessonId, resetOnMount, startSeconds, videoId]);

  if (failed) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-black px-6 text-center">
        <div>
          <p className="text-sm font-medium text-white">We couldn&apos;t load this video.</p>
          <button
            type="button"
            className="mt-4 inline-flex h-11 items-center rounded-md px-4 text-sm text-white underline-offset-4 hover:underline"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <div ref={hostRef} className="size-full" />
      </div>
      {warning ? <ProgressWarning message={warning} onRetry={retry} /> : null}
    </div>
  );
}
