import { backendFetch } from "@/lib/backend/client";

// width/height loosened to nullable at this data-layer boundary (Phase 5
// §6 instruction: adapt the type here rather than touch the database) —
// review_media doesn't track them, and no component actually reads them:
// every avatar/media <Image> in ReviewsList.tsx/Results.tsx renders with
// `fill`, which needs no width/height props at all. Confirmed by reading
// those components before making this change, not assumed.
export type ReviewImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ProductReview = {
  id: string;
  author: string;
  rating: number;
  body: string;
  date: string;
  verifiedPurchase: boolean;
  avatar: ReviewImage | null;
  media: ReviewImage[];
  // Always false now. The old Shopify-era demo/sample-review fallback
  // (lib/shopify/demo-reviews.ts) doesn't exist in this data layer at
  // all — the backend never fabricates reviews (Architecture §09), and
  // this instruction is explicit: "Do not fabricate review data." A
  // product with zero real reviews now just honestly shows zero.
  isDemo: boolean;
};

export type ProductReviewSummary = {
  reviews: ProductReview[];
  averageRating: number | null;
  reviewCount: number;
  isDemo: boolean;
};

const EMPTY_SUMMARY: ProductReviewSummary = { reviews: [], averageRating: null, reviewCount: 0, isDemo: false };

type BackendReviewMedia = { url: string; altText: string | null; kind: string };
type BackendReview = {
  id: string;
  author: string;
  rating: number;
  body: string;
  date: string;
  verifiedPurchase: boolean;
  avatar: null;
  media: BackendReviewMedia[];
};
type BackendReviewSummary = { reviews: BackendReview[]; averageRating: number | null; reviewCount: number };

function mapReview(review: BackendReview): ProductReview {
  return {
    id: review.id,
    author: review.author,
    rating: review.rating,
    body: review.body,
    date: review.date,
    verifiedPurchase: review.verifiedPurchase,
    avatar: null,
    media: review.media.map((item) => ({ url: item.url, altText: item.altText, width: null, height: null })),
    isDemo: false,
  };
}

// Returns the honest empty summary on a missing/unknown product, a
// backend error, or a request failure — ProductReviews.tsx already
// renders that as a genuine "no reviews yet" state.
export async function getProductReviews(productHandle: string): Promise<ProductReviewSummary> {
  try {
    const data = await backendFetch<BackendReviewSummary>(`/api/reviews/${encodeURIComponent(productHandle)}`, {
      next: { revalidate: 300 },
    });
    return {
      reviews: data.reviews.map(mapReview),
      averageRating: data.averageRating,
      reviewCount: data.reviewCount,
      isDemo: false,
    };
  } catch (error) {
    console.error("Volrep backend getProductReviews error:", error);
    return EMPTY_SUMMARY;
  }
}

// Both kept as identity passthroughs, not deleted — page.tsx's existing
// call sites (getReviewsSectionSummary for the full list,
// getHeroReviewSummary for the compact badge) need zero changes even
// though the demo-data fallback they used to apply no longer exists.
export function getReviewsSectionSummary(realSummary: ProductReviewSummary): ProductReviewSummary {
  return realSummary;
}

export function getHeroReviewSummary(realSummary: ProductReviewSummary): ProductReviewSummary {
  return realSummary;
}
