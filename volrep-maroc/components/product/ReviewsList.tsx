"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { ProductReview } from "@/lib/backend/reviews";
import { t } from "@/lib/i18n";

// Grid page size — 3-up on desktop x 2 rows reads as one full, uncramped
// screen of reviews before paging. Bumping this doesn't require any other
// change here; ReviewsList already paginates whatever length it's given,
// which is what lets it scale to 10, 50, 100+ reviews without a redesign.
const REVIEWS_PER_PAGE = 6;

// Gold is reserved sitewide for real, earned star ratings (see globals.css's
// --gold token comment and Results.tsx's own GoldStars) — this renders the
// actual per-review rating rounded to whole stars, never a hardcoded 5.
function StarRow({ rating, className = "text-sm" }: { rating: number; className?: string }) {
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

function VerifiedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-volt/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-volt">
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
    </span>
  );
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

function ReviewAvatar({ review }: { review: ProductReview }) {
  if (review.avatar) {
    return (
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
        <Image src={review.avatar.url} alt="" fill sizes="36px" className="object-cover" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
    >
      {getInitials(review.author)}
    </span>
  );
}

function formatReviewDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function ReviewCard({ review }: { review: ProductReview }) {
  const formattedDate = formatReviewDate(review.date);

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-black/[0.06] bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <StarRow rating={review.rating} className="text-base" />
        {review.verifiedPurchase && <VerifiedBadge />}
      </div>

      <p className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground">{review.body}</p>

      {review.media.length > 0 && (
        <div className="mt-4 flex gap-2">
          {review.media.slice(0, 4).map((image, i) => (
            <span key={`${review.id}-media-${i}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              <Image src={image.url} alt={image.altText ?? ""} fill sizes="56px" className="object-cover" />
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 border-t border-black/[0.06] pt-5">
        <ReviewAvatar review={review} />
        <div>
          <p className="text-sm font-semibold text-foreground">{review.author}</p>
          {formattedDate && <p className="mt-0.5 text-xs text-muted-foreground">{formattedDate}</p>}
        </div>
      </div>
    </div>
  );
}

function PageButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? t.product.reviews.previousPage : t.product.reviews.nextPage}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:border-volt hover:text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/25 disabled:hover:border-ink/10 disabled:hover:text-ink/25"
    >
      <span aria-hidden="true" className="text-sm">
        {direction === "prev" ? "←" : "→"}
      </span>
    </button>
  );
}

export function ReviewsList({ reviews }: { reviews: ProductReview[] }) {
  const [page, setPage] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const start = page * REVIEWS_PER_PAGE;
  const visibleReviews = reviews.slice(start, start + REVIEWS_PER_PAGE);

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(next, 0), pageCount - 1);
    setPage(clamped);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <div ref={topRef}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {pageCount > 1 && (
        <nav aria-label={t.product.reviews.pagination} className="mt-10 flex items-center justify-center gap-4">
          <PageButton direction="prev" onClick={() => goToPage(page - 1)} disabled={page === 0} />
          <span className="text-sm font-medium text-muted-foreground">
            {t.product.reviews.pageOf(page + 1, pageCount)}
          </span>
          <PageButton direction="next" onClick={() => goToPage(page + 1)} disabled={page === pageCount - 1} />
        </nav>
      )}
    </div>
  );
}
