import type { reviews, reviewMedia } from "../db/schema/index.js";

type ReviewRow = typeof reviews.$inferSelect;
type ReviewMediaRow = typeof reviewMedia.$inferSelect;

export type ApiReviewMedia = { url: string; altText: string | null; kind: string };

export type ApiReview = {
  id: string;
  author: string;
  rating: number;
  body: string;
  date: string;
  verifiedPurchase: boolean;
  // Always null — this backend has no avatar-upload feature. Kept as an
  // explicit field (not omitted) so the shape still lines up with the
  // frontend's existing ProductReview.avatar for the eventual adapter.
  avatar: null;
  media: ApiReviewMedia[];
};

export type ApiReviewSummary = {
  reviews: ApiReview[];
  averageRating: number | null;
  reviewCount: number;
};

export function mapReview(review: ReviewRow, media: ReviewMediaRow[]): ApiReview {
  return {
    id: review.id,
    author: review.author,
    rating: review.rating,
    body: review.body,
    date: review.createdAt.toISOString(),
    // Generated column (Architecture §03/§09) — this value is never
    // settable directly by any insert or update, only computed from
    // whether a real order backs the review.
    verifiedPurchase: review.verifiedPurchase ?? false,
    avatar: null,
    media: media.map((item) => ({ url: item.url, altText: null, kind: item.kind })),
  };
}
