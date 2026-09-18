// Client-side poster (first-frame thumbnail) for an MP4 the admin just picked.
//
// Why: the UGC MP4s are not "faststart" (moov atom at the end), and iOS
// Safari will not paint a first frame for a <video> without a `poster`, so
// the storefront cards look like empty gradient rectangles until Play is
// tapped. The storefront already renders `poster`; this only produces the
// image, from the LOCAL File, so nothing is decoded on the server.
//
// Best-effort by design: every failure path throws, and the caller treats a
// throw as "no poster" — it must never affect the video upload itself.

const TARGET_WIDTH = 360;
const JPEG_QUALITY = 0.8;
const IDEAL_SEEK_SECONDS = 0.1;
const STEP_TIMEOUT_MS = 8000;

/**
 * Time to seek to for the poster frame: ~0.1s in, but never past the middle
 * of a very short clip, and 0 when the duration is unknown / zero.
 */
export function posterSeekTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(IDEAL_SEEK_SECONDS, duration / 2);
}

/** Output size: `targetWidth` wide (never upscaled), aspect ratio preserved. */
export function posterSize(
  videoWidth: number,
  videoHeight: number,
  targetWidth: number = TARGET_WIDTH,
): { width: number; height: number } | null {
  if (!(videoWidth > 0) || !(videoHeight > 0)) return null;
  const width = Math.min(targetWidth, videoWidth);
  const height = Math.max(1, Math.round((width * videoHeight) / videoWidth));
  return { width: Math.round(width), height };
}

/** Resolves on `event`, rejects on the element's `error` or after a timeout. */
function once(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => done(new Error(`video poster: ${event} timed out`)), STEP_TIMEOUT_MS);
    const onEvent = () => done();
    const onError = () => done(new Error("video poster: the video could not be decoded"));
    function done(err?: Error) {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      if (err) reject(err);
      else resolve();
    }
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}

/** Renders an early frame of `file` as a small JPEG. Throws if it can't. */
export async function captureVideoPoster(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    // Attach the listener before assigning src so the event can't be missed.
    const loaded = once(video, "loadeddata");
    video.src = objectUrl;
    await loaded;

    const seekTo = posterSeekTime(video.duration);
    if (seekTo > 0) {
      const seeked = once(video, "seeked");
      video.currentTime = seekTo;
      await seeked;
    }

    const size = posterSize(video.videoWidth, video.videoHeight);
    if (!size) throw new Error("video poster: video has no dimensions");

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("video poster: canvas 2d context unavailable");
    ctx.drawImage(video, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size === 0) throw new Error("video poster: canvas produced no image");
    return blob;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
