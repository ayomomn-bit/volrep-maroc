import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { reviewStatus } from "./enums.js";
import { products } from "./catalog.js";
import { orders } from "./orders.js";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // The paid order backing this review, if any. SET NULL (not CASCADE):
    // an order being deleted shouldn't delete the review, just demote it
    // from verified.
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    author: text("author").notNull(),
    // Moderation contact only — never returned by the public API.
    email: text("email"),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    status: reviewStatus("status").notNull().default("pending"),
    // Generated, not settable — the "no fake verified purchases" guarantee
    // enforced at the schema level (Architecture §03/§09). No insert or
    // update can set this column directly; it can only ever be true when
    // order_id references a real order.
    verifiedPurchase: boolean("verified_purchase").generatedAlwaysAs(sql`(order_id is not null)`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productStatusIdx: index("reviews_product_id_status_idx").on(table.productId, table.status),
    orderIdx: index("reviews_order_id_idx").on(table.orderId),
    ratingRange: check("reviews_rating_check", sql`${table.rating} between 1 and 5`),
  }),
);

export const reviewMedia = pgTable(
  "review_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: text("kind").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => ({
    reviewIdx: index("review_media_review_id_idx").on(table.reviewId),
    kindCheck: check("review_media_kind_check", sql`${table.kind} in ('image', 'video')`),
  }),
);
