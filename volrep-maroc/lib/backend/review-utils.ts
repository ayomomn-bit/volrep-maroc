// Pure, client-safe helper for ProductReview data — split out of
// lib/backend/reviews.ts for the same reason the original
// lib/shopify/review-utils.ts was: that module's top-level code
// constructs the backend client (lib/backend/client.ts), which reads
// server-only env vars and throws if they're missing — fine in a Server
// Component, but fatal if a "use client" component (Results.tsx) imports
// a *value* from reviews.ts, since that pulls the whole module (and the
// client's construction) into the browser bundle.
import type { ProductReview } from "@/lib/backend/reviews";

// Reviews arrive already sorted most-recent-first (see getProductReviews
// in reviews.ts), so the featured one is simply the most recent — no
// separate "featured" flag to maintain in the data itself.
export function splitFeaturedReview(reviews: ProductReview[]): {
  featuredReview: ProductReview | null;
  otherReviews: ProductReview[];
} {
  const [featuredReview = null, ...otherReviews] = reviews;
  return { featuredReview, otherReviews };
}
