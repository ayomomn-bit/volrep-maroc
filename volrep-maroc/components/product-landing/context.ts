import type { ShopifyProduct } from "@/lib/backend/products";
import type { ProductReviewSummary } from "@/lib/backend/reviews";

// The live, backend-owned data every section may need alongside its own
// editorial `data`. Product identity / price / images / variants stay the
// source of truth from GET /api/products/:handle; reviews from
// GET /api/reviews/:handle. The Product Studio document never owns any of
// this.
export type SectionContext = {
  product: ShopifyProduct;
  reviewSummary: ProductReviewSummary;
  /** formatted, e.g. "899 MAD" */
  price: string;
  /** formatted compare-at, or null */
  oldPrice: string | null;
  /** integer percentage, or null when there is no genuine discount */
  discountPercent: number | null;
};

export const STARS = "★★★★★";
