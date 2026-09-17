import Image from "next/image";
import type { HomepageMediaSlot } from "@/lib/homepage/types";

// Product "stage" for VOLREP PRM™: a dark, contained frame with its own
// corner/caption chrome. When the Homepage Studio Hero media slot is filled
// (image, GIF, or MP4), that asset renders as the stage's background layer,
// first in DOM order so the corner markers / badge / caption (all
// absolutely positioned) stack on top of it unchanged. Empty/placeholder
// media falls back to the plain frame exactly as before.
const TM = "™";

function splitTrademark(name: string): { base: string; hasTm: boolean } {
  if (name.endsWith(TM)) return { base: name.slice(0, -TM.length), hasTm: true };
  return { base: name, hasTm: false };
}

export function HeroProductVisual({
  media,
  badge,
  productName,
  caption,
}: {
  media: HomepageMediaSlot;
  badge: string;
  productName: string;
  caption: string;
}) {
  const { base, hasTm } = splitTrademark(productName);
  const hasMedia = media.kind !== "placeholder" && Boolean(media.url);
  const isVideo = media.mediaType === "video";

  return (
    <div className="hero-media-enter relative aspect-[4/5] w-full bg-ink transition-transform duration-500 ease-out sm:aspect-[4/3] hover:scale-[1.01]">
      {hasMedia &&
        (isVideo ? (
          <video
            src={media.url}
            poster={media.poster || undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // This is the homepage's LCP element: it must be discoverable and
          // fetched at high priority, never lazy (loading="lazy" was the
          // default here and is what previously delayed LCP by seconds).
          <Image
            src={media.url}
            alt={media.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading="eager"
            fetchPriority="high"
            className="object-cover"
          />
        ))}

      <span aria-hidden="true" className="absolute left-4 top-4 h-3 w-3 border-l border-t border-paper/25" />
      <span aria-hidden="true" className="absolute right-4 top-4 h-3 w-3 border-r border-t border-paper/25" />
      <span aria-hidden="true" className="absolute bottom-4 left-4 h-3 w-3 border-b border-l border-paper/25" />
      <span aria-hidden="true" className="absolute bottom-4 right-4 h-3 w-3 border-b border-r border-paper/25" />

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-2/5 w-2/5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/10"
      />

      <div aria-hidden="true" className="absolute left-5 top-5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-volt" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-paper/50">{badge}</span>
      </div>

      <div className="absolute inset-x-5 bottom-5">
        <p className="text-sm font-medium tracking-tight text-paper">
          {base}
          {hasTm && <span aria-hidden="true">{TM}</span>}
        </p>
        <p className="mt-1 text-xs text-paper/55">{caption}</p>
      </div>
    </div>
  );
}
