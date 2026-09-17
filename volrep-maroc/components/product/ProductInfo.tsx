"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ShopifyProduct } from "@/lib/backend/products";
import type { ProductReviewSummary } from "@/lib/backend/reviews";
import { findVariantBySelectedOptions } from "@/lib/backend/variant";
import { AddToCart } from "@/components/product/AddToCart";
import { BenefitsList } from "@/components/product/BenefitsList";
import { BuyNowButton } from "@/components/product/BuyNowButton";
import { ProductPrice } from "@/components/product/ProductPrice";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { VariantPicker } from "@/components/product/VariantPicker";
import { t } from "@/lib/i18n";

// Gold marks an actually-earned star (see globals.css's --gold token
// comment); unfilled stars stay a neutral ink tint, same rule ProductReviews
// / ReviewsList follow for the full reviews section below.
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-[18px] w-[18px] ${filled ? "text-gold" : "text-ink/15"}`}
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.05 6.6.79-4.87 4.6 1.28 6.56L12 17.5l-5.91 3 1.28-6.56-4.87-4.6 6.6-.79z" />
    </svg>
  );
}

// Reads the aggregate from getHeroReviewSummary() (lib/shopify/reviews.ts)
// — real Shopify reviews when they exist, a DEMO/DEVELOPMENT-ONLY synthetic
// count (DEMO_REVIEW_COUNT in demo-reviews.ts) while they don't yet, or the
// honest "No reviews yet" empty state if demo data is off too. Populated
// (reviewCount > 0) always renders the same compact "★★★★★ N reviews" —
// no average-rating number, no CTA — whether the count behind it is real or
// demo; only the empty state keeps its "Write the first review" link,
// since that's the one case where there's a genuine call to action.
function ReviewsBadge({ summary }: { summary: ProductReviewSummary }) {
  const { averageRating, reviewCount } = summary;
  const hasReviews = reviewCount > 0;
  const filledStars = hasReviews ? Math.round(averageRating ?? 0) : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} filled={i < filledStars} />
        ))}
      </span>
      {hasReviews ? (
        <span className="text-sm font-medium text-slate">
          {t.product.reviewsBadge.count(reviewCount)}
        </span>
      ) : (
        <>
          <span className="text-sm font-medium text-slate">{t.product.reviewsBadge.none}</span>
          {/* Real destination even before any reviews exist — #reviews is
              rendered by ProductReviews further down this same page, which
              shows the matching empty state there too. */}
          <Link
            href="#reviews"
            className="text-sm font-medium text-volt underline decoration-volt/30 underline-offset-2 transition-colors duration-200 ease-out hover:decoration-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t.product.reviewsBadge.writeFirst}
          </Link>
        </>
      )}
    </div>
  );
}

// The client-state boundary for the product form: selected variant and
// quantity live here so VariantPicker, ProductPrice, QuantitySelector, and
// AddToCart can all react to the same selection. TrustBadges is rendered
// server-side by ProductHero and passed in as a slot so it isn't pulled
// into this client bundle.
export function ProductInfo({
  product,
  reviewSummary,
  trustBadges,
  paymentMethods,
}: {
  product: ShopifyProduct;
  reviewSummary: ProductReviewSummary;
  trustBadges?: ReactNode;
  paymentMethods?: ReactNode;
}) {
  const firstVariant = product.variants[0] ?? null;

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries((firstVariant?.selectedOptions ?? []).map((option) => [option.name, option.value])),
  );
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = useMemo(
    () => findVariantBySelectedOptions(product.variants, selectedOptions),
    [product.variants, selectedOptions],
  );

  function handleOptionChange(optionName: string, value: string) {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
  }

  return (
    // Plain normal-flow column — ProductGallery is the sticky one now (see
    // ProductHero/ProductGallery), so this just scrolls with the page.
    <div className="py-2 lg:py-4">
      <ReviewsBadge summary={reviewSummary} />

      {/* Reviews → title → price → description read as one tight-knit
          group (mt-4/mt-3/mt-5) — everything past the description steps
          back out to the section's normal, more generous rhythm. */}
      <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
        {product.title}
      </h1>

      <p className="mt-1.5 text-lg font-medium leading-snug text-slate sm:text-xl">
        {t.common.productDescriptor}
      </p>

      <div className="mt-3">
        <ProductPrice
          price={selectedVariant?.price ?? product.price}
          compareAtPrice={selectedVariant?.compareAtPrice ?? product.compareAtPrice}
        />
      </div>

      {product.description && (
        <p className="mt-5 max-w-[520px] text-lg leading-[1.85] text-slate">{product.description}</p>
      )}

      <div className="mt-10">
        <BenefitsList />
      </div>

      {product.options.length > 0 && (
        <div className="mt-10">
          <VariantPicker options={product.options} selectedOptions={selectedOptions} onChange={handleOptionChange} />
        </div>
      )}

      {/* CTA area: quantity + Add to Cart in one row, Buy Now beneath —
          fixed-width stepper, button fills the rest, all three h-16
          (64px) so they read as one control. */}
      <div className="mt-16 flex items-stretch gap-3">
        <QuantitySelector quantity={quantity} onChange={setQuantity} />
        <AddToCart
          variantId={selectedVariant?.id ?? ""}
          quantity={quantity}
          available={selectedVariant?.availableForSale ?? product.availableForSale}
        />
      </div>

      <div className="mt-3.5">
        <BuyNowButton
          variantId={selectedVariant?.id ?? ""}
          quantity={quantity}
          available={selectedVariant?.availableForSale ?? product.availableForSale}
        />
      </div>

      {paymentMethods && <div className="mt-11">{paymentMethods}</div>}

      <div className="mt-16">{trustBadges}</div>
    </div>
  );
}
