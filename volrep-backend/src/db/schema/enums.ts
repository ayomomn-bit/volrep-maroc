import { pgEnum } from "drizzle-orm/pg-core";

// Mirrors "Volrep Backend Architecture" §03 exactly — one enum per status
// column across the schema.

export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);

export const cartStatus = pgEnum("cart_status", ["active", "converted", "abandoned"]);

// "cod" and "card" are both valid `checkout_sessions.provider` values, not a
// separate enum — see checkout.ts's comment for why provider stays a plain
// text column instead of an enum (a future payment provider must be
// addable without a migration to widen this list).
export const checkoutSessionStatus = pgEnum("checkout_session_status", [
  "pending",
  "completed",
  "expired",
  "canceled",
]);

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "fulfilled",
  "partially_fulfilled",
  "canceled",
  "refunded",
  "partially_refunded",
]);

export const fulfillmentStatus = pgEnum("fulfillment_status", ["unfulfilled", "fulfilled"]);

export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"]);

export const adminRole = pgEnum("admin_role", ["owner", "staff"]);

// Product Studio content blocks (Phase 7C-3). Each value is a structured
// block type the studio composes on a product page; the JSON shape of
// `product_content_blocks.data` is validated per-type at the service layer,
// never here. Adding a new block type is an additive `ALTER TYPE ... ADD
// VALUE` migration plus a new zod schema + editor — the block system is
// designed to grow this list without a redesign.
export const contentBlockType = pgEnum("content_block_type", [
  "benefits",
  "selling_points",
  "text_media",
  "image_text",
  "feature_highlights",
]);
