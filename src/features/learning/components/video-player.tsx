"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoPlayer } from "@/features/learning/components/vimeo-player";
import { YouTubePlayer } from "@/features/learning/components/youtube-player";
import { RESUME_NOTICE_SECONDS, RESUME_SEEK_SECONDS } from "@/features/learning/progress";
import { formatClock } from "@/features/courses/format";
import type { VideoEmbed } from "@/lib/video/provider";

export function VideoPlayer({
  lessonId,
  playback,
  hasVideo = false,
  startSeconds,
  trackProgress,
}: {
  lessonId: string;
  playback: VideoEmbed | null;
  hasVideo?: boolean;
  startSeconds: number;
  trackProgress: boolean;
}) {
  const router = useRouter();
  const [restart, setRestart] = useState({ lessonId, on: false });
  const restarted = restart.lessonId === lessonId && restart.on;

  const resumeAt = !restarted && startSeconds >= RESUME_NOTICE_SECONDS ? startSeconds : 0;
  const playFrom = restarted ? 0 : startSeconds;

  if (!playback) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted/40 px-6 text-center">
        <div>
          <p className="text-sm font-medium">
            {hasVideo ? "We couldn't load this video." : "This lesson does not have a video yet."}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            You can still read the lesson and mark it complete.
          </p>
          {hasVideo ? (
            <button
              type="button"
              className="mt-4 inline-flex h-11 items-center text-sm text-primary"
              onClick={() => router.refresh()}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const resumeNote =
    trackProgress && resumeAt > 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">
        Resumed at {formatClock(resumeAt)}
        <button
          type="button"
          className="ml-3 inline-flex h-11 items-center text-primary"
          onClick={() => setRestart({ lessonId, on: true })}
        >
          Start over
        </button>
      </p>
    ) : null;

  if (playback.provider === "YOUTUBE") {
    const videoId = playback.src.split("/").filter(Boolean).pop()?.split("?")[0] ?? "";
    return (
      <div>
        <YouTubePlayer
          key={`${lessonId}:${restarted ? "start" : "resume"}`}
          lessonId={lessonId}
          videoId={videoId}
          startSeconds={playFrom}
          trackProgress={trackProgress}
          resetOnMount={restarted}
        />
        {resumeNote}
      </div>
    );
  }

  if (playback.provider === "VIMEO") {
    const src = playFrom >= RESUME_SEEK_SECONDS ? `${playback.src}#t=${Math.floor(playFrom)}s` : playback.src;
    return (
      <div>
        <VimeoPlayer
          key={`${lessonId}:${restarted ? "start" : "resume"}`}
          lessonId={lessonId}
          src={src}
          startSeconds={playFrom}
          trackProgress={trackProgress}
          resetOnMount={restarted}
        />
        {resumeNote}
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-black">
      <iframe
        title="Lesson video"
        src={playback.src}
        className="size-full"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
