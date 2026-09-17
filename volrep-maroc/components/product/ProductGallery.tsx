"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ShopifyImage } from "@/lib/backend/products";
import { t } from "@/lib/i18n";

// Frosted, floating nav arrows that sit inside the image itself (not
// outside it) — the "arrows inside image" premium-gallery convention seen
// on Therabody/Eight Sleep product pages, rather than arrows bracketing
// the frame from outside.
const NAV_ARROW =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/5 bg-white/90 text-ink shadow-[0_8px_20px_-6px_rgba(11,11,11,0.25)] backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-0";

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      {direction === "left" ? <path d="M15 5 8 12l7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

// Shared between the desktop and mobile layouts below: a horizontally
// scrollable thumbnail strip. Active thumbnail gets the accent border,
// a lifted shadow, and a slight scale — everything else fades in on
// hover so the row feels alive without being noisy.
function ThumbnailRow({
  images,
  activeIndex,
  onSelect,
}: {
  images: ShopifyImage[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length <= 1) return null;

  return (
    <div ref={trackRef} className="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth px-0.5 py-1.5">
      {images.map((image, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={image.url}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={t.product.gallery.showImage(index + 1, images.length)}
            aria-current={isActive}
            className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F8F6F3] shadow-[0_4px_12px_-6px_rgba(11,11,11,0.15)] transition-all duration-[250ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 ${
              isActive
                ? "scale-105 border-2 border-volt shadow-[0_8px_20px_-6px_rgba(54,143,253,0.4)]"
                : "border border-ink/10 hover:scale-[1.03] hover:border-ink/25 hover:shadow-[0_6px_16px_-6px_rgba(11,11,11,0.2)]"
            }`}
          >
            <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        );
      })}
    </div>
  );
}

// One large stage image (soft-shadowed, rounded, on a clean white surface)
// with floating in-frame arrows, and a thumbnail rail below. Desktop
// crossfades between images (all stacked, opacity-toggled, no library);
// mobile uses native scroll-snap for swipe, with the same arrows overlaid.
// Both share one activeIndex so thumbnails/arrows never drift out of sync
// — only one layout is visible per breakpoint (same pattern as
// Header/MobileNav elsewhere in this app).
export function ProductGallery({ images, title }: { images: ShopifyImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  function goToIndex(index: number) {
    setActiveIndex(index);
    const track = trackRef.current;
    if (track) {
      track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
    }
  }

  function handleTrackScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex((prev) => (prev === index ? prev : index));
  }

  return (
    // Sticky lives on this root grid item, not on a nested child: Chromium
    // only grants a sticky element real scroll "travel room" when it's the
    // grid item itself — nested one level deeper (inside a plain wrapper
    // div), the same position:sticky;top:120px computes a zero-length
    // travel window and never visibly sticks, even though getComputedStyle
    // reports "sticky" correctly. Confirmed empirically before landing this.
    // lg-only (mobile stays plain, normal flow, per spec). top-[120px]
    // clears the sticky black header (72px) + promo bar (36px) with a
    // little breathing room.
    <div className="min-w-0 lg:sticky lg:top-[120px]">
      {/* Desktop */}
      {/* 600px → 680px (~13% larger): the roller is meant to be the
          visual anchor of the page, not a thumbnail sharing space with
          copy. Still comfortably inside the 55% column at 1440px. */}
      <div className="hidden lg:block lg:max-w-[680px]">
        <div className="group relative aspect-square overflow-hidden rounded-[24px] border border-ink/5 bg-[#F8F6F3] shadow-[0_20px_56px_-24px_rgba(11,11,11,0.16),0_8px_24px_-12px_rgba(11,11,11,0.08)]">
          {/* 3% frame inset (down from 5%) + a 1.1x static zoom on the
              image itself crop into the source photo's own padding —
              together they read as a materially larger product without
              growing the card or risking cropping the roller's edges. */}
          <div className="absolute inset-[3%] overflow-hidden">
            {images.map((image, index) => (
              <Image
                key={image.url}
                src={image.url}
                alt={image.altText ?? title}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                priority={index === 0}
                className={`scale-[1.1] object-contain transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.15] ${
                  index === activeIndex ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
          </div>

          {images.length > 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-5 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
              <button
                type="button"
                onClick={() => goToIndex(Math.max(0, activeIndex - 1))}
                disabled={activeIndex === 0}
                aria-label={t.product.gallery.previousImage}
                className={`pointer-events-auto ${NAV_ARROW}`}
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                onClick={() => goToIndex(Math.min(images.length - 1, activeIndex + 1))}
                disabled={activeIndex === images.length - 1}
                aria-label={t.product.gallery.nextImage}
                className={`pointer-events-auto ${NAV_ARROW}`}
              >
                <ArrowIcon direction="right" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-7">
          <ThumbnailRow images={images} activeIndex={activeIndex} onSelect={goToIndex} />
        </div>
      </div>

      {/* Mobile / tablet */}
      <div className="lg:hidden">
        <div className="relative overflow-hidden rounded-[24px] border border-ink/5 bg-[#F8F6F3] shadow-[0_16px_44px_-20px_rgba(11,11,11,0.18),0_6px_18px_-10px_rgba(11,11,11,0.08)]">
          <div
            ref={trackRef}
            onScroll={handleTrackScroll}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          >
            {images.map((image, index) => (
              <div key={image.url} className="relative aspect-square w-full shrink-0 snap-center">
                <div className="absolute inset-[3%] overflow-hidden">
                  <Image
                    src={image.url}
                    alt={image.altText ?? title}
                    fill
                    sizes="100vw"
                    priority={index === 0}
                    className="scale-[1.08] object-contain"
                  />
                </div>
              </div>
            ))}
          </div>

          {images.length > 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-3">
              <button
                type="button"
                onClick={() => goToIndex(Math.max(0, activeIndex - 1))}
                disabled={activeIndex === 0}
                aria-label={t.product.gallery.previousImage}
                className={`pointer-events-auto ${NAV_ARROW}`}
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                onClick={() => goToIndex(Math.min(images.length - 1, activeIndex + 1))}
                disabled={activeIndex === images.length - 1}
                aria-label={t.product.gallery.nextImage}
                className={`pointer-events-auto ${NAV_ARROW}`}
              >
                <ArrowIcon direction="right" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <ThumbnailRow images={images} activeIndex={activeIndex} onSelect={goToIndex} />
        </div>
      </div>
    </div>
  );
}
