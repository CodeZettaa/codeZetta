"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { updateLesson } from "@/features/admin/actions";
import { fieldControl } from "@/features/admin/components/course-fields";
import { VideoPlayer } from "@/features/learning/components/video-player";
import { detectVideo, toEmbed } from "@/lib/video/provider";
import { cn } from "cn";

export function LessonEditorForm({
  courseId,
  courseStatus,
  lessonId,
  updatedAt,
  title,
  slug,
  description,
  minutes,
  seconds,
  videoRef,
  isPreview,
  focusVideo = false,
}: {
  courseId: string;
  courseStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  lessonId: string;
  updatedAt: string;
  title: string;
  slug: string;
  description: string;
  minutes: number;
  seconds: number;
  videoRef: string | null;
  isPreview: boolean;
  focusVideo?: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  const [phase, setPhase] = useState<"saved" | "saving" | "failed">("saved");
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState(updatedAt);
  const stampRef = useRef(updatedAt);
  const tail = useRef(Promise.resolve());
  const timer = useRef<number | null>(null);
  const [videoUrl, setVideoUrl] = useState(videoRef ?? "");
  const detected = videoUrl.trim() ? detectVideo(videoUrl) : null;
  const playback = detected ? toEmbed(detected) : null;

  function enqueue(mode: "auto" | "full") {
    const run = tail.current.then(async () => {
      const form = document.getElementById("lesson-editor");
      if (!(form instanceof HTMLFormElement)) return;
      if (mode === "auto" && videoUrl.trim() && !detectVideo(videoUrl)) return;
      const data = new FormData(form);
      const url = String(data.get("videoUrl") ?? "");
      if (mode === "auto" && url.trim() && !detectVideo(url)) return;
      data.set("updatedAt", stampRef.current);
      data.set("saveMode", mode);
      setPhase("saving");
      const result = await updateLesson(null, data);
      if (result?.startsWith("saved:")) {
        stampRef.current = result.slice(6);
        setStamp(stampRef.current);
        setDirty(false);
        setError(null);
        setPhase("saved");
        return;
      }
      setError(result ?? "Save failed");
      setPhase("failed");
    });
    tail.current = run.then(
      () => undefined,
      () => undefined,
    );
  }

  function scheduleAuto() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => enqueue("auto"), 800);
  }

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest("a");
      if (!link) return;
      if (!window.confirm("You have unsaved changes. Leave this lesson?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        document.querySelector<HTMLFormElement>("#lesson-editor")?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!focusVideo) return;
    document.getElementById("videoUrl")?.focus();
  }, [focusVideo]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const status = phase === "saving" ? "Saving…" : phase === "failed" ? "Save failed" : dirty ? "Unsaved changes" : "Saved";

  return (
    <form
      id="lesson-editor"
      className="mt-8 grid max-w-xl gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) window.clearTimeout(timer.current);
        enqueue("full");
      }}
    >
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="updatedAt" value={stamp} />

      <section className="grid gap-4">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Basic</h2>
        <div className="grid gap-2">
          <Label htmlFor="title">Lesson title</Label>
          <Input id="title" name="title" required defaultValue={title} className="h-10" onChange={() => { setDirty(true); scheduleAuto(); }} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Short description</Label>
          <textarea id="description" name="description" rows={5} defaultValue={description} className={fieldControl} onChange={() => { setDirty(true); scheduleAuto(); }} />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Video</h2>
        <div className="grid gap-2">
          <Label htmlFor="videoUrl">Video URL</Label>
          <Input
            id="videoUrl"
            name="videoUrl"
            value={videoUrl}
            onChange={(event) => {
              setVideoUrl(event.target.value);
              setDirty(true);
              if (!event.target.value.trim() || detectVideo(event.target.value)) scheduleAuto();
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="h-10"
            aria-invalid={Boolean(videoUrl.trim() && !detected)}
          />
          {videoUrl.trim() && !detected ? (
            <p className="text-sm text-destructive">Enter a valid YouTube or Vimeo URL.</p>
          ) : (
            <p className="text-xs text-muted-foreground">YouTube, Vimeo, or another https link. Leave empty for a text lesson.</p>
          )}
        </div>
        {playback ? (
          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Preview video</p>
            <VideoPlayer lessonId={lessonId} playback={playback} hasVideo startSeconds={0} trackProgress={false} />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="minutes">Minutes</Label>
            <Input id="minutes" name="minutes" type="number" min={0} defaultValue={minutes} className="h-10" onChange={() => setDirty(true)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seconds">Seconds</Label>
            <Input id="seconds" name="seconds" type="number" min={0} max={59} defaultValue={seconds} className="h-10" onChange={() => setDirty(true)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Settings</h2>
        <div className="grid gap-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" name="slug" required defaultValue={slug} className="h-10" onChange={() => setDirty(true)} />
          {courseStatus === "PUBLISHED" ? (
            <p className="text-xs text-muted-foreground">Changing this URL may break existing links.</p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPreview" defaultChecked={isPreview} className="size-4" onChange={() => setDirty(true)} />
          Free preview
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={phase === "saving"} className={cn(buttonVariants(), "h-10 px-4")}>
          {phase === "saving" ? "Saving…" : "Save"}
        </button>
        <p className={cn("text-sm text-muted-foreground", error && "text-destructive")}>{error ?? status}</p>
      </div>
    </form>
  );
}
