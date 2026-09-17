import { PageContainer } from "@/components/layout/PageContainer";
import { ReviewsList } from "@/components/product/ReviewsList";
import type { ProductReviewSummary } from "@/lib/backend/reviews";
import { t } from "@/lib/i18n";

// Same star-row recipe as ReviewsList's — duplicated locally rather than
// imported (matches this codebase's existing convention of small icon
// helpers living per-file; see Header/MobileNav's own duplicated icon set).
function StarRow({ filled, className = "text-lg" }: { filled: number; className?: string }) {
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

// The spec calls for "★★★★★" here, but rendering it in gold would read as
// a fabricated 5.0 average — gold is reserved sitewide for stars a real
// rating has actually earned (see globals.css's --gold token comment).
// These five glyphs stay neutral/outline instead: the shape the design
// asks for, without implying a rating that doesn't exist yet.
function EmptyReviewsState() {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center py-4 text-center">
      <StarRow filled={0} className="text-2xl" />
      <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Soyez le premier à donner votre avis
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        Partagez votre expérience avec le VOLREP PRM<span aria-hidden="true">™</span>.
      </p>
      {/* No review-submission flow exists yet (out of scope here — this
          product page only needs to display real reviews once they exist,
          not collect them) — "#" is the same not-yet-built-destination
          convention already used elsewhere in this codebase (e.g. Footer's
          About/Journal links). Swapping in a real destination later doesn't
          change anything else in this component. */}
      <a
        href="#"
        className="mt-6 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-volt underline decoration-volt/30 underline-offset-4 transition-colors duration-200 ease-out hover:decoration-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t.product.reviewsBadge.writeFirst} <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

// Dedicated real-reviews section for the product page — the detailed
// counterpart to Results.tsx's "Real Results / Real Recovery" social proof
// further up this page. Both sections render the exact same
// ProductReviewSummary object (see page.tsx's reviewsSectionSummary,
// computed once via getReviewsSectionSummary() in lib/shopify/reviews.ts)
// rather than keeping independent review data — Results shows a compact
// average/featured-review view of it, this one paginates the full list.
// summary.isDemo drives every piece of copy below that would otherwise
// claim these are real customer reviews; it never affects the rating math
// or the card UI itself, which stay identical for real and sample data.
export function ProductReviews({ summary }: { summary: ProductReviewSummary }) {
  const { reviews, averageRating, reviewCount, isDemo } = summary;
  const hasReviews = reviewCount > 0;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="bg-background py-16 sm:py-20 lg:py-24">
      <PageContainer>
        <div className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
            {t.product.reviews.customerReviews}
          </p>

          <h2
            id="reviews-heading"
            className="mt-5 text-[1.75rem] uppercase leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[2.375rem] lg:text-[2rem] xl:text-[2.875rem]"
          >
            Ce que disent nos clients.
          </h2>

          {hasReviews && isDemo && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t.product.reviews.sampleDisclosure}
            </p>
          )}
        </div>

        {hasReviews ? (
          <>
            <div className="mx-auto mt-14 flex flex-col items-center gap-3 text-center sm:mt-16">
              <div className="flex items-center justify-center gap-3">
                <StarRow filled={Math.round(averageRating ?? 0)} className="text-2xl sm:text-3xl" />
                <span className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground sm:text-5xl">{averageRating}</span>
                  <span className="text-lg font-medium text-muted-foreground sm:text-xl">/5</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isDemo ? t.product.reviews.sampleReviews : t.product.reviews.basedOn(reviewCount)}
              </p>
            </div>

            <div className="mt-12 sm:mt-14">
              <ReviewsList reviews={reviews} />
            </div>
          </>
        ) : (
          <div className="mt-14 sm:mt-16">
            <EmptyReviewsState />
          </div>
        )}
      </PageContainer>
    </section>
  );
}
