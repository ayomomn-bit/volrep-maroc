"use client";

import { useRef, useState } from "react";

export type LpUgcVideo = {
  id: string;
  // An MP4 clip -> rendered as <video> with the click-to-play overlay.
  src?: string;
  // An animated GIF -> rendered as a looping <img> (no overlay, no controls).
  gifSrc?: string;
  poster?: string;
  // Label shown in the empty-slot state; defaults to the original copy.
  emptyLabel?: string;
};

// Reference `.customer-say-section` horizontal video slider. Real UGC clips
// drop in via the `videos` prop as the brand delivers them; until then each
// card is a structured "Vidéo client — à venir" slot (same placeholder
// convention as the existing VOLREP UgcShowcase), so the reel keeps its
// exact shape and scroll behavior with no fabricated media.
const PLACEHOLDERS: LpUgcVideo[] = [
  { id: "01" },
  { id: "02" },
  { id: "03" },
  { id: "04" },
  { id: "05" },
];

export function LpVideoSlider({ videos = PLACEHOLDERS }: { videos?: LpUgcVideo[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const refs = useRef<Map<string, HTMLVideoElement>>(new Map());

  function toggle(id: string) {
    const el = refs.current.get(id);
    if (!el) return;
    refs.current.forEach((other, otherId) => {
      if (otherId !== id && !other.paused) other.pause();
    });
    if (el.paused) {
      void el.play();
      setPlayingId(id);
    } else {
      el.pause();
      setPlayingId((cur) => (cur === id ? null : cur));
    }
  }

  return (
    <div className="video-slider-wrap">
      <div className="video-slider">
        {videos.map((video) => (
          <div
            key={video.id}
            className={`video-card ${playingId === video.id ? "playing" : ""}`}
            onClick={() => video.src && toggle(video.id)}
            role={video.src ? "button" : undefined}
            tabIndex={video.src ? 0 : undefined}
          >
            {video.src ? (
              <>
                <video
                  ref={(el) => {
                    if (el) refs.current.set(video.id, el);
                    else refs.current.delete(video.id);
                  }}
                  src={video.src}
                  poster={video.poster}
                  preload="metadata"
                  playsInline
                  loop
                  className="ugc-video"
                />
                <div className="video-overlay">
                  <span className="play-icon">▶</span>
                </div>
              </>
            ) : video.gifSrc ? (
              // Animated GIF — the browser loops it natively. No <video>
              // controls / overlay, no autoplay/sound logic needed.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.gifSrc} alt="" className="ugc-video" loading="lazy" decoding="async" />
            ) : (
              <div className="video-empty">
                <span className="play-icon" aria-hidden="true">
                  ▶
                </span>
                <span>{video.emptyLabel ?? "Vidéo client · à venir"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
