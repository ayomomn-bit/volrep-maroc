import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { cartStatus, checkoutSessionStatus } from "./enums.js";
import { productVariants } from "./catalog.js";

export const carts = pgTable(
  "carts",
  {
    // This id IS the opaque value stored in the volrep_cart_id cookie —
    // no separate token column (Architecture §03).
    id: uuid("id").primaryKey().defaultRandom(),
    status: cartStatus("status").notNull().default("active"),
    currency: text("currency").notNull().default("MAD"),
    // Set on creation (30 days, matching today's cookie maxAge), extended
    // on every mutation. No stored totals — subtotal/total are always
    // computed live from current variant prices at read time (§06).
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    expiresAtIdx: index("carts_expires_at_idx").on(table.expiresAt),
    statusIdx: index("carts_status_idx").on(table.status),
  }),
);

export const cartLines = pgTable(
  "cart_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    // RESTRICT: a variant referenced by an active cart line can't be
    // hard-deleted (archive it instead) — surfaces as a clear admin error
    // rather than silently orphaning carts (Architecture §03).
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Adding an already-present variant upserts the quantity instead of
    // duplicating a row — matches Shopify's own cart-line merge behavior.
    cartVariantUnique: unique("cart_lines_cart_id_variant_id_unique").on(table.cartId, table.variantId),
    cartIdx: index("cart_lines_cart_id_idx").on(table.cartId),
    quantityPositive: check("cart_lines_quantity_check", sql`${table.quantity} > 0`),
  }),
);

// V1 note (Phase 3 COD decision): `provider` is a plain text column, not an
// enum, specifically so a future payment provider (e.g. CMI) can be added
// by writing a new adapter and inserting a new provider value — never a
// migration that widens an enum. For COD, a session is created and marked
// 'completed' synchronously in the same request that creates the order
// (no redirect, no webhook) — see src/services/checkout.ts. When a card
// provider is added later, its sessions flow through this exact same
// table with status starting 'pending' and completing asynchronously via
// webhook, so the order/checkout domain itself does not change.
export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    // The provider's own session/intent id. For COD, this is an
    // internally-generated id (no external provider exists to issue one).
    providerSessionId: text("provider_session_id").notNull(),
    status: checkoutSessionStatus("status").notNull().default("pending"),
    amountTotal: numeric("amount_total", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    shippingAddress: jsonb("shipping_address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    // The webhook lookup key for card providers; for COD this is just a
    // uniqueness guard on the internally-generated id.
    providerSessionUnique: unique("checkout_sessions_provider_session_unique").on(
      table.provider,
      table.providerSessionId,
    ),
    cartIdx: index("checkout_sessions_cart_id_idx").on(table.cartId),
    statusIdx: index("checkout_sessions_status_idx").on(table.status),
  }),
);
