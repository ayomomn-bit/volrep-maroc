import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { fulfillmentStatus, orderStatus } from "./enums.js";
import { checkoutSessions } from "./cart.js";
import { productVariants } from "./catalog.js";

// Order numbers are human-facing sequential integers, formatted "#1001" at
// the API layer only — matching TrackOrderForm's existing placeholder/
// validation pattern exactly (Architecture §03). Starts at 1001 so the
// first real order reads the same as the frontend's own example text.
export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001, minValue: 1001 });

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: integer("order_number")
      .notNull()
      .default(sql`nextval('order_number_seq')`),
    // 1:1 with checkout_sessions — enforced by the unique constraint below.
    // This is the DB-level idempotency guard: a second attempt to create an
    // order for the same session fails the constraint instead of creating
    // a duplicate (Architecture §07/§08).
    checkoutSessionId: uuid("checkout_session_id")
      .notNull()
      .references(() => checkoutSessions.id, { onDelete: "restrict" }),
    // NOT NULL: required both for the order-confirmation email (§12) and
    // because GET /api/orders/track's access control is an email match
    // against this exact column (Architecture §04/§14) — an orderable
    // without an email would be untrackable by design.
    email: text("email").notNull(),
    // COD delivery contact — an explicit, queryable column (not buried in
    // shippingAddress JSON) since admin/fulfillment genuinely needs to
    // search and see this directly. Addition beyond the original
    // architecture doc, justified by COD's operational requirement: the
    // delivery driver has to be able to call the customer.
    phone: text("phone").notNull(),
    status: orderStatus("status").notNull().default("pending_payment"),
    subtotalAmount: numeric("subtotal_amount", { precision: 10, scale: 2 }).notNull(),
    shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    // Reserved; no discount feature exists yet (Phase 1 audit, §02).
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    shippingAddress: jsonb("shipping_address").notNull(),
    // 'cod' today; a future provider's own identifier once card payments
    // are added — never hard-coded to one provider (Phase 3 COD decision).
    paymentProvider: text("payment_provider").notNull(),
    // For COD, null until the driver actually collects cash — see
    // paidAt below. For a future card provider, the charge/payment_intent id.
    paymentReference: text("payment_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderNumberUnique: unique("orders_order_number_unique").on(table.orderNumber),
    checkoutSessionUnique: unique("orders_checkout_session_id_unique").on(table.checkoutSessionId),
    emailIdx: index("orders_email_idx").on(table.email),
    statusIdx: index("orders_status_idx").on(table.status),
  }),
);

export const orderLineItems = pgTable(
  "order_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // Nullable + SET NULL so a later variant deletion never breaks
    // historical orders (Architecture §03).
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    // Frozen at order time — never recomputed, unlike cart lines which
    // always read the live variant price (§06 vs. this table's footnote
    // in the architecture doc).
    productTitle: text("product_title").notNull(),
    variantTitle: text("variant_title").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPriceAmount: numeric("unit_price_amount", { precision: 10, scale: 2 }).notNull(),
    lineTotalAmount: numeric("line_total_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index("order_line_items_order_id_idx").on(table.orderId),
    quantityPositive: check("order_line_items_quantity_check", sql`${table.quantity} > 0`),
  }),
);

export const fulfillments = pgTable(
  "fulfillments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: fulfillmentStatus("status").notNull().default("unfulfilled"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index("fulfillments_order_id_idx").on(table.orderId),
  }),
);

// Reserved for the future card-payment provider's webhook idempotency
// guard (Architecture §03/§07) — insert-or-ignore on (provider, event_id)
// before any order logic runs. Not written to by anything in V1 (COD has
// no webhooks), but the table exists now so the schema doesn't need a
// migration when a provider is added.
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    providerEventUnique: unique("webhook_events_provider_event_id_unique").on(table.provider, table.eventId),
  }),
);
