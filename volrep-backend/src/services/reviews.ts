import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { AppError } from "../lib/errors.js";
import { products, reviewMedia, reviews } from "../db/schema/index.js";
import { mapReview, type ApiReviewSummary } from "../mappers/review.js";

// Public, read-only. No submission endpoint exists yet — the current
// frontend's "Write the first review" link doesn't go anywhere real
// either (Phase 1 audit), so there is no contract to satisfy there. Only
// `status = 'approved'` rows are ever returned; nothing here can promote
// a review to approved or to verified — those happen only via direct
// admin action (approval) and the schema's generated column (purchase
// verification), neither of which this function touches.
export async function getApprovedReviews(handle: string): Promise<ApiReviewSummary> {
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.handle, handle)).limit(1);
  if (!product) throw AppError.notFound("Product not found");

  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, product.id), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt));

  if (rows.length === 0) {
    return { reviews: [], averageRating: null, reviewCount: 0 };
  }

  const mediaRows = await db
    .select()
    .from(reviewMedia)
    .where(inArray(reviewMedia.reviewId, rows.map((row) => row.id)))
    .orderBy(asc(reviewMedia.position));

  const mediaByReview = new Map<string, typeof mediaRows>();
  for (const media of mediaRows) {
    const list = mediaByReview.get(media.reviewId) ?? [];
    list.push(media);
    mediaByReview.set(media.reviewId, list);
  }

  const averageRating = Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 10) / 10;

  return {
    reviews: rows.map((row) => mapReview(row, mediaByReview.get(row.id) ?? [])),
    averageRating,
    reviewCount: rows.length,
  };
}
