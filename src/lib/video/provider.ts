export type VideoProviderName = "YOUTUBE" | "VIMEO" | "EXTERNAL";

export type VideoSource = {
  provider: VideoProviderName;
  ref: string;
};

export type VideoEmbed = {
  provider: VideoProviderName;
  src: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Turns a stored provider reference into an embed URL.
 * Unlisted YouTube videos embed with their id. Truly private videos do not.
 * A later provider can replace this with a short-lived signed URL.
 */
export function detectVideo(input: string): VideoSource | null {
  const ref = input.trim();
  if (!ref) return null;
  if (youtubeId(ref)) return { provider: "YOUTUBE", ref };
  if (vimeoId(ref)) return { provider: "VIMEO", ref };
  if (isHttpsUrl(ref)) return { provider: "EXTERNAL", ref };
  return null;
}

export function toEmbed(source: VideoSource): VideoEmbed | null {
  const ref = source.ref.trim();
  if (!ref) return null;

  switch (source.provider) {
    case "YOUTUBE": {
      const id = youtubeId(ref);
      if (!id) return null;
      return {
        provider: "YOUTUBE",
        src: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    case "VIMEO": {
      const id = vimeoId(ref);
      if (!id) return null;
      return {
        provider: "VIMEO",
        src: `https://player.vimeo.com/video/${id}`,
      };
    }
    case "EXTERNAL": {
      if (!isHttpsUrl(ref)) return null;
      return { provider: "EXTERNAL", src: ref };
    }
  }
}

function youtubeId(ref: string) {
  if (YOUTUBE_ID.test(ref)) return ref;

  try {
    const url = new URL(ref);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && YOUTUBE_ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts");
      const id = embedIndex >= 0 ? parts[embedIndex + 1] : undefined;
      return id && YOUTUBE_ID.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

function vimeoId(ref: string) {
  if (/^\d+$/.test(ref)) return ref;

  try {
    const url = new URL(ref);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const id = url.pathname.split("/").filter((part) => /^\d+$/.test(part)).at(-1);
    return id ?? null;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
