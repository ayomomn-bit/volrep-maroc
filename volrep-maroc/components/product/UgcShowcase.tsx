"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

type UgcVideo = {
  id: string;
  videoSrc?: string;
  poster?: string;
  creatorHandle?: string;
  caption?: string;
};

// Real UGC clips land here as they're delivered by the brand/creators — each
// slot stays a placeholder (no videoSrc/poster/creatorHandle/caption) until
// then. Populating or replacing a video is a data change only; nothing below
// needs to change to grow or shrink the set.
const VIDEOS: UgcVideo[] = [
  { id: "01" },
  { id: "02" },
  { id: "03" },
  { id: "04" },
  { id: "05" },
  { id: "06" },
  { id: "07" },
  { id: "08" },
  { id: "09" },
  { id: "10" },
];

// Gap between cards (px) — kept as one number so the track's flex `gap-6`
// class and the arrow-scroll distance stay derived from the same value.
const CARD_GAP = 24;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-6 w-6 translate-x-[1px]">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" />
    </svg>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type VideoCardProps = {
  video: UgcVideo;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  videoRef: (el: HTMLVideoElement | null) => void;
};

// Portrait 9:16 card — the aspect-ratio class alone reserves the correct box
// before any video/poster loads, so nothing shifts as clips come in.
function VideoCard({ video, isPlaying, onPlay, onPause, videoRef }: VideoCardProps) {
  const hasOverlayInfo = Boolean(video.creatorHandle || video.caption);
  const label = video.creatorHandle ? ` de ${video.creatorHandle}` : "";

  return (
    <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-ink shadow-[0_24px_60px_-24px_rgba(11,11,11,0.45)]">
      {video.videoSrc ? (
        <>
          <video
            ref={videoRef}
            src={video.videoSrc}
            poster={video.poster}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onPlay={onPlay}
            onPause={onPause}
            onEnded={onPause}
          />

          {/* Full-card hit target — click anywhere to toggle play/pause,
              not just the small icon, while the icon itself stays subtle
              per spec ("subtle play button overlay"). */}
          <button
            type="button"
            onClick={() => (isPlaying ? onPause() : onPlay())}
            aria-label={`${isPlaying ? "Mettre en pause" : "Lire"} la vidéo${label}`}
            className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              aria-hidden="true"
              className={`flex h-14 w-14 items-center justify-center rounded-full bg-paper/90 text-ink shadow-[0_8px_24px_rgba(11,11,11,0.25)] transition-opacity duration-300 ${
                isPlaying ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100"
              }`}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </span>
          </button>
        </>
      ) : (
        // Cinematic empty state — a plain dark panel (the card's own bg-ink),
        // a minimal outlined play ring, and a whisper-quiet label. Deliberately
        // reads like a paused video frame rather than a missing-content notice,
        // so the grid still feels like a real (if not yet populated) reel.
        <div className="flex h-full w-full flex-col items-center justify-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-paper/25 text-paper/60"
          >
            <PlayIcon />
          </span>
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-paper/35">Vidéo client</p>
        </div>
      )}

      {/* Solid scrim, not a gradient — matches the site's "no gradients"
          rule while still keeping caption text legible over video. */}
      {hasOverlayInfo && (
        <div className="absolute inset-x-0 bottom-0 bg-ink/55 px-4 py-3 backdrop-blur-sm">
          {video.creatorHandle && <p className="text-sm font-semibold text-paper">{video.creatorHandle}</p>}
          {video.caption && <p className="mt-0.5 text-xs leading-snug text-paper/80">{video.caption}</p>}
        </div>
      )}
    </div>
  );
}

// UGC / social-proof section for the product page. Native horizontally-
// scrolling, scroll-snapped track — same no-dependency approach as the
// homepage's <ProductCarousel>, tuned for portrait cards: a mobile peek
// (~1.2 cards visible) instead of ProductCarousel's near-full-width mobile
// card, since the brief calls for the next card to visibly peek in from the
// right on small screens.
export function UgcShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [visible, setVisible] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ fraction: 1, position: 0 });
  const canNavigate = VIDEOS.length > 1;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function updateProgress() {
      const current = trackRef.current;
      if (!current) return;
      const maxScroll = current.scrollWidth - current.clientWidth;
      const fraction = current.scrollWidth > 0 ? Math.min(1, current.clientWidth / current.scrollWidth) : 1;
      const position = maxScroll > 0 ? current.scrollLeft / maxScroll : 0;
      setProgress({ fraction, position });
    }

    updateProgress();
    track.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      track.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  function scrollByDirection(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track || !canNavigate) return;

    const card = track.querySelector<HTMLElement>("[data-carousel-card]");
    const amount = card ? card.offsetWidth + CARD_GAP : track.clientWidth * 0.85;

    track.scrollBy({ left: amount * direction, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function handleTrackKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByDirection(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByDirection(-1);
    }
  }

  function handlePlay(id: string) {
    // Only one clip plays at a time — starting a new one pauses whichever
    // was already running instead of letting several autoplay-style videos
    // stack up.
    videoRefs.current.forEach((el, videoId) => {
      if (videoId !== id && !el.paused) el.pause();
    });
    setPlayingId(id);
  }

  function handlePause(id: string) {
    setPlayingId((current) => (current === id ? null : current));
  }

  return (
    <section ref={sectionRef} aria-labelledby="ugc-showcase-heading" className="bg-background py-16 sm:py-20 lg:py-24">
      <PageContainer>
        <div
          className={`mx-auto max-w-2xl text-center transition-all duration-700 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            De vraies personnes / Une vraie récupération
          </p>

          <h2
            id="ugc-showcase-heading"
            className="mt-5 text-[1.75rem] uppercase leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[2.375rem] lg:text-[2.5rem] xl:text-[2.875rem]"
          >
            VOLREP en action.
          </h2>

          <p className="mx-auto mt-6 max-w-[480px] text-base leading-relaxed text-muted-foreground sm:text-lg">
            De vraies personnes. De vraies routines. Une vraie récupération.
          </p>
        </div>

        <div
          className={`mt-10 flex items-center gap-6 transition-all delay-100 duration-700 ease-out sm:mt-12 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div
            role="progressbar"
            aria-label="Position de défilement du carrousel"
            aria-valuenow={Math.round(progress.position * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative h-[3px] w-full max-w-[240px] overflow-hidden rounded-full bg-black/[0.08]"
          >
            <div
              className="absolute inset-y-0 rounded-full bg-ink transition-[left,width] duration-150 ease-out"
              style={{
                width: `${progress.fraction * 100}%`,
                left: `${progress.position * (100 - progress.fraction * 100)}%`,
              }}
            />
          </div>

          {/* Always rendered, disabled (not hidden) when there's nothing to
              navigate to — reads as "not yet" rather than broken. */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByDirection(-1)}
              disabled={!canNavigate}
              aria-label="Vidéo précédente"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:border-volt hover:text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/25 disabled:hover:border-ink/10 disabled:hover:text-ink/25 lg:h-9 lg:w-9"
            >
              <span aria-hidden="true" className="text-sm">
                ←
              </span>
            </button>
            <button
              type="button"
              onClick={() => scrollByDirection(1)}
              disabled={!canNavigate}
              aria-label="Vidéo suivante"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:border-volt hover:text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/25 disabled:hover:border-ink/10 disabled:hover:text-ink/25 lg:h-9 lg:w-9"
            >
              <span aria-hidden="true" className="text-sm">
                →
              </span>
            </button>
          </div>
        </div>

        {/* preload="metadata" on each <video> (below) already caps network
            cost to just headers per card, and nothing plays until a viewer
            presses play — so the horizontal scroller doesn't need its own
            viewport-based mount/unmount logic on top of that. */}
        <div
          ref={trackRef}
          role="region"
          aria-label="Vidéos des clients VOLREP"
          aria-roledescription="carrousel"
          tabIndex={0}
          onKeyDown={handleTrackKeyDown}
          className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mt-10"
        >
          {/* Widths target ~1.2 cards on mobile (peek hints at scrollability),
              ~2-3 on tablet, and exactly 5 on desktop — calc() (not a plain
              percentage) so the 4 gaps between 5 cards are subtracted from
              the container width and all 5 land fully inside it. */}
          {VIDEOS.map((video) => (
            <div
              key={video.id}
              data-carousel-card
              className="w-[80%] shrink-0 snap-start snap-always sm:w-[54%] md:w-[38%] lg:w-[calc(20%-19px)]"
            >
              <VideoCard
                video={video}
                isPlaying={playingId === video.id}
                onPlay={() => handlePlay(video.id)}
                onPause={() => handlePause(video.id)}
                videoRef={(el) => {
                  if (el) videoRefs.current.set(video.id, el);
                  else videoRefs.current.delete(video.id);
                }}
              />
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
