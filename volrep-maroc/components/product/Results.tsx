"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { splitFeaturedReview } from "@/lib/backend/review-utils";
import type { ProductReview, ProductReviewSummary } from "@/lib/backend/reviews";
import { t } from "@/lib/i18n";

// Secondary carousel cap — keeps the DOM/scroll track a reasonable size
// even once real review volume grows past a handful. The featured card
// above it always takes the single most recent review, so this is "up to
// 8 more" rather than "everything else".
const MAX_SECONDARY_REVIEWS = 8;

type ProofPoint = {
  title: string;
  description: string;
};

// Grounded in the same verified product facts already used by
// HowItWorks/Technology/Comparison — not new claims invented for this
// section (4D rolling contact, hands-free/body-weight use, everyday
// routine — see those files' own sourcing comments). Independent of review
// data, so these render regardless of whether any reviews exist yet.
const PROOF_POINTS: ProofPoint[] = [
  {
    title: "Récupération musculaire profonde",
    description: "Conçu pour une pression ciblée et une récupération quotidienne.",
  },
  {
    title: "Récupération mains libres",
    description: "Utilisez le poids de votre corps pour créer une pression contrôlée.",
  },
  {
    title: "Conçu pour un usage quotidien",
    description: "Pensé pour s’intégrer naturellement à votre routine.",
  },
];

const CARD_GAP = 24;

// Tailwind's transition-delay scale — literal strings so the JIT scanner
// picks them up even though they're selected dynamically below. Same
// duplicated scroll-reveal pattern used throughout the site.
const REVEAL_DELAYS = [
  "delay-[0ms]",
  "delay-[80ms]",
  "delay-[160ms]",
  "delay-[240ms]",
  "delay-[320ms]",
  "delay-[400ms]",
  "delay-[480ms]",
  "delay-[560ms]",
];

function revealClass(visible: boolean, step: number) {
  const delay = REVEAL_DELAYS[Math.min(step, REVEAL_DELAYS.length - 1)];
  return `${delay} transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatReviewDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

// Renders review.avatar (a real Shopify-hosted image) when present, initials
// otherwise — same fallback ReviewsList.tsx uses for the dedicated reviews
// section below, so an avatar looks identical whichever of the two places
// it appears.
function ReviewAvatar({ review, size = "h-11 w-11 text-sm" }: { review: ProductReview; size?: string }) {
  if (review.avatar) {
    return (
      <span className={`relative shrink-0 overflow-hidden rounded-full ${size}`}>
        <Image src={review.avatar.url} alt="" fill sizes="48px" className="object-cover" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ${size}`}
    >
      {getInitials(review.author)}
    </span>
  );
}

// The second line under a reviewer's name: "Verified Purchase" in VOLREP
// blue when the review data actually says so, the review's date otherwise.
// Never the other way around — verifiedPurchase comes straight from
// lib/shopify/reviews.ts (false for every demo-reviews.ts entry, real
// purchase data only once a real review sets it), so this can't show a
// verified claim demo/sample content hasn't earned.
function ReviewMeta({ review }: { review: ProductReview }) {
  if (review.verifiedPurchase) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-volt">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {t.product.reviews.verifiedPurchase}
      </p>
    );
  }

  const formattedDate = formatReviewDate(review.date);
  return formattedDate ? <p className="mt-0.5 text-xs text-muted-foreground">{formattedDate}</p> : null;
}

// Gold is reserved sitewide for exactly this — see globals.css's --gold
// token comment. Renders the actual rating (rounded to whole stars) rather
// than a hardcoded 5, so a real non-5-star review renders correctly;
// unfilled stars use a neutral tone, never gold, so gold keeps meaning
// "this star is earned."
function GoldStars({ rating, className = "text-sm" }: { rating: number; className?: string }) {
  const filled = Math.round(rating);
  return (
    <span aria-hidden="true" className={`tracking-[0.2em] ${className}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? "text-gold" : "text-black/10"}>
          ★
        </span>
      ))}
    </span>
  );
}

function QuoteMark({ size = "h-6 w-6" }: { size?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`text-volt ${size}`}>
      <path d="M9.5 6C6.5 7.6 5 10 5 12.8c0 2.4 1.4 3.9 3.3 3.9 1.7 0 3-1.3 3-3 0-1.6-1.1-2.8-2.6-2.9.3-1.5 1.5-2.9 3.1-3.7L9.5 6Zm9 0c-3 1.6-4.5 4-4.5 6.8 0 2.4 1.4 3.9 3.3 3.9 1.7 0 3-1.3 3-3 0-1.6-1.1-2.8-2.6-2.9.3-1.5 1.5-2.9 3.1-3.7L18.5 6Z" />
    </svg>
  );
}

function ReviewCard({ review, visible, step }: { review: ProductReview; visible: boolean; step: number }) {
  return (
    <div
      className={`flex h-full flex-col rounded-[24px] border border-black/[0.06] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${revealClass(visible, step)}`}
    >
      <div className="flex items-center justify-between">
        <GoldStars rating={review.rating} />
        <QuoteMark size="h-4 w-4" />
      </div>
      <p className="mt-5 flex-1 text-[15px] leading-relaxed text-foreground">&ldquo;{review.body}&rdquo;</p>
      <div className="mt-6 flex items-center gap-3">
        <ReviewAvatar review={review} size="h-9 w-9 text-xs" />
        <div>
          <p className="text-sm font-semibold text-foreground">{review.author}</p>
          <ReviewMeta review={review} />
        </div>
      </div>
    </div>
  );
}

// Results / Social Proof section for the product page. Consumes the exact
// same ProductReviewSummary object (see lib/shopify/reviews.ts) that the
// dedicated reviews section (ProductReviews.tsx, further down this page)
// renders — page.tsx computes it once via getReviewsSectionSummary() and
// passes the same reference to both, so there is one array of reviews on
// this page, not two. This section used to keep its own hardcoded
// `ratingSummary`/`testimonials` constants; that duplicate dataset is gone.
// When summary.isDemo is true (lib/shopify/demo-reviews.ts's sample data,
// standing in until real reviews exist), the rating block says so plainly
// rather than presenting sample content as real customer feedback — same
// disclosure ProductReviews.tsx shows. The three proof points below are
// independent, verified product facts, not reviews, so they render
// regardless of whether any review data exists yet.
export function Results({ summary }: { summary: ProductReviewSummary }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState({ fraction: 1, position: 0 });

  const { reviews, averageRating, reviewCount, isDemo } = summary;
  const hasReviews = reviewCount > 0;
  const { featuredReview, otherReviews: allOtherReviews } = splitFeaturedReview(reviews);
  const otherReviews = allOtherReviews.slice(0, MAX_SECONDARY_REVIEWS);
  const canNavigate = otherReviews.length > 1;

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
  }, [otherReviews.length]);

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

  return (
    <section ref={sectionRef} aria-labelledby="results-heading" className="bg-background py-16 sm:py-20 lg:py-24">
      <PageContainer>
        <div className="mx-auto max-w-2xl text-center">
          <p
            className={`flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${revealClass(visible, 0)}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            De vrais résultats / Une vraie récupération
          </p>

          <h2
            id="results-heading"
            className={`mt-5 text-[1.75rem] uppercase leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[2.375rem] lg:text-[2rem] xl:text-[2.875rem] ${revealClass(visible, 1)}`}
          >
            Une récupération qui se ressent.
          </h2>

          <p
            className={`mx-auto mt-6 max-w-[440px] text-base leading-relaxed text-muted-foreground sm:text-lg ${revealClass(visible, 2)}`}
          >
            Des expériences réelles de personnes qui utilisent le VOLREP PRM<span aria-hidden="true">™</span> dans
            leur routine de récupération.
          </p>
        </div>

        {hasReviews && (
          <>
            {/* Large rating block — premium summary format (gold stars + big
                black average + muted "/5"), sourced from the same
                ProductReviewSummary the dedicated reviews section below
                renders. isDemo swaps the caption for an explicit disclosure
                instead of a real review count — never both at once. */}
            <div className={`mx-auto mt-14 flex flex-col items-center gap-3 text-center sm:mt-16 ${revealClass(visible, 2)}`}>
              <div className="flex items-center justify-center gap-3">
                <GoldStars rating={averageRating ?? 0} className="text-2xl sm:text-3xl" />
                <span className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground sm:text-5xl">{averageRating}</span>
                  <span className="text-lg font-medium text-muted-foreground sm:text-xl">/5</span>
                </span>
              </div>
              {isDemo ? (
                <p className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {t.product.reviews.sampleDisclosure}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.product.reviews.basedOn(reviewCount)}
                </p>
              )}
            </div>
          </>
        )}

        {/* Gap to the proof points below trimmed ~15-18% from the previous
            mt-14/mt-16 (56px/64px) to mt-12/mt-13 (48px/52px) — same "airy
            but connected" rhythm, just tightened per feedback. */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-10 sm:mt-13 sm:grid-cols-3 sm:gap-8">
          {PROOF_POINTS.map((point, i) => (
            <div key={point.title} className={`flex flex-col items-center text-center ${revealClass(visible, i + 3)}`}>
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-volt/[0.1] text-volt">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground sm:text-xl">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.description}</p>
            </div>
          ))}
        </div>

        {featuredReview && (
          <>
            {/* Featured review — the section's dominant visual moment.
                Same blue-top-border "featured" language as the Comparison
                section's VOLREP column, reused here rather than inventing a
                new "this one is special" treatment. Always the most recent
                review in the shared array (see splitFeaturedReview) — no
                separate editorial "featured" flag to keep in sync. */}
            <div
              className={`relative mx-auto mt-16 max-w-3xl rounded-[28px] border border-black/[0.06] border-t-[3px] border-t-volt bg-white p-10 shadow-[0_20px_50px_-28px_rgba(11,11,11,0.16)] sm:mt-20 sm:p-14 ${revealClass(visible, 4)}`}
            >
              <div className="flex items-start justify-between">
                <GoldStars rating={featuredReview.rating} className="text-lg" />
                <QuoteMark size="h-8 w-8 sm:h-9 sm:w-9" />
              </div>
              <p className="mt-6 text-2xl font-medium leading-[1.5] text-foreground sm:text-[28px]">
                &ldquo;{featuredReview.body}&rdquo;
              </p>
              <div className="mt-8 flex items-center gap-4">
                <ReviewAvatar review={featuredReview} />
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{featuredReview.author}</p>
                  <ReviewMeta review={featuredReview} />
                </div>
              </div>
            </div>

            {otherReviews.length > 0 && (
              /* Secondary reviews — native scroll-snap carousel, same
                 no-dependency approach as ProductCarousel/UgcShowcase: 3 up
                 on desktop, 2 on tablet, ~1.1 (mobile peek) below that. */
              <div className="mt-12 sm:mt-14">
                <div className={`flex items-center justify-end gap-2 ${revealClass(visible, 5)}`}>
                  <div
                    role="progressbar"
                    aria-label={t.product.reviews.scrollPosition}
                    aria-valuenow={Math.round(progress.position * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="relative h-[3px] w-full max-w-[160px] overflow-hidden rounded-full bg-black/[0.08]"
                  >
                    <div
                      className="absolute inset-y-0 rounded-full bg-volt transition-[left,width] duration-150 ease-out"
                      style={{
                        width: `${progress.fraction * 100}%`,
                        left: `${progress.position * (100 - progress.fraction * 100)}%`,
                      }}
                    />
                  </div>

                  <div className="ml-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollByDirection(-1)}
                      disabled={!canNavigate}
                      aria-label={t.product.reviews.previousReview}
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
                      aria-label={t.product.reviews.nextReview}
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
                  role="region"
                  aria-label={t.product.reviews.additionalReviews}
                  aria-roledescription="carrousel"
                  tabIndex={0}
                  onKeyDown={handleTrackKeyDown}
                  className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {otherReviews.map((review, i) => (
                    <div
                      key={review.id}
                      data-carousel-card
                      className="w-[88%] shrink-0 snap-start snap-always sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                    >
                      <ReviewCard review={review} visible={visible} step={Math.min(i + 5, REVEAL_DELAYS.length - 1)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </PageContainer>
    </section>
  );
}
