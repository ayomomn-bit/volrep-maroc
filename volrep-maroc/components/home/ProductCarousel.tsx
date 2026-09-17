"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/home/ProductCard";
import type { ShopifyProductSummary } from "@/lib/backend/products";
import { t } from "@/lib/i18n";

type ProductCarouselProps = {
  heading: ReactNode;
  products: ShopifyProductSummary[];
};

// 1 card per screen (with a small peek to hint at swiping) on mobile, 2 on
// small tablets, 3 on larger tablets, 4 on desktop — widths account for the
// track's 24px (gap-6) gaps so cards land exactly on the breakpoint's
// visible count with no partial overflow card. snap-always keeps a fast
// swipe from skipping past a card on mobile's near-full-width layout.
const CARD_WIDTH_CLASSES =
  "w-[92%] shrink-0 snap-start snap-always sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]";

// The only interactive piece of the Best Sellers section: a native
// horizontally-scrolling, scroll-snapped track. No carousel dependency —
// touch/trackpad swipe works for free via the browser, and the arrow
// buttons just nudge that same scroll position by one card width.
export function ProductCarousel({ heading, products }: ProductCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const canNavigate = products.length > 1;

  function scrollByDirection(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track || !canNavigate) return;

    const card = track.querySelector<HTMLElement>("[data-carousel-card]");
    const gap = 24;
    const amount = card ? card.offsetWidth + gap : track.clientWidth * 0.85;

    track.scrollBy({ left: amount * direction, behavior: "smooth" });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        {heading}

        {/* Always rendered, disabled (not hidden) when there's nothing to
            navigate to — reads as "not yet" rather than broken. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByDirection(-1)}
            disabled={!canNavigate}
            aria-label={t.carousel.previousProduct}
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
            aria-label={t.carousel.nextProduct}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:border-volt hover:text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/25 disabled:hover:border-ink/10 disabled:hover:text-ink/25 lg:h-9 lg:w-9"
          >
            <span aria-hidden="true" className="text-sm">
              →
            </span>
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:mt-10 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div key={product.id} data-carousel-card className={CARD_WIDTH_CLASSES}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
