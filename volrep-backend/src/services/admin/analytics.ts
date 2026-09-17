import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orderLineItems, orders, productVariants, products, reviews } from "../../db/schema/index.js";
import { toMoney } from "../../lib/money.js";
import { DEFAULT_LOW_STOCK_THRESHOLD, REVENUE_STATUSES, queryLowStockVariants } from "./dashboard.js";

// Basic STORE-LEVEL analytics (Phase 7C-5). Aggregates only — no customer
// PII (no email / phone / address), no COD-operational metric (no
// confirmation rate, no delivery, no fulfilment, no agent performance),
// and NO mutation. Everything is computed from existing tables; there is
// no analytics table and no migration.
//
// Metrics: revenue, order count, top products (period-scoped) + low stock
// and pending reviews (point-in-time). "Revenue" reuses the dashboard's
// REVENUE_STATUSES definition verbatim — it is not redefined here.

export const ANALYTICS_PERIODS = ["7d", "30d", "all"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export { DEFAULT_LOW_STOCK_THRESHOLD };

// Store currency. The catalog is MAD-only today (same assumption the
// dashboard endpoint already hard-codes).
const STORE_CURRENCY = "MAD";
const TOP_PRODUCTS_LIMIT = 5;

function periodStart(period: AnalyticsPeriod): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export type StoreAnalyticsInput = {
  period: AnalyticsPeriod;
  lowStockThreshold: number;
};

export async function getStoreAnalytics({ period, lowStockThreshold }: StoreAnalyticsInput) {
  const since = periodStart(period);

  const revenueWhere = since
    ? and(inArray(orders.status, [...REVENUE_STATUSES]), gte(orders.createdAt, since))
    : inArray(orders.status, [...REVENUE_STATUSES]);
  const ordersCountWhere = since ? gte(orders.createdAt, since) : undefined;

  const [revenueRow, ordersCountRow, topRows, lowStockRows, pendingReviewsRow] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text` })
      .from(orders)
      .where(revenueWhere),

    db.select({ value: count() }).from(orders).where(ordersCountWhere),

    // Top products: units + line revenue from revenue-bearing orders in
    // the period. Grouped by product via the line item's variant → so a
    // line whose variant was later deleted (variant_id NULL) is not
    // attributed. Line revenue = sum(line_total_amount), shipping excluded.
    db
      .select({
        productId: products.id,
        title: products.title,
        handle: products.handle,
        unitsSold: sql<number>`coalesce(sum(${orderLineItems.quantity}), 0)::int`,
        revenue: sql<string>`coalesce(sum(${orderLineItems.lineTotalAmount}), 0)::text`,
      })
      .from(orderLineItems)
      .innerJoin(orders, eq(orderLineItems.orderId, orders.id))
      .innerJoin(productVariants, eq(orderLineItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        since
          ? and(inArray(orders.status, [...REVENUE_STATUSES]), gte(orders.createdAt, since))
          : inArray(orders.status, [...REVENUE_STATUSES]),
      )
      .groupBy(products.id, products.title, products.handle)
      .orderBy(sql`sum(${orderLineItems.lineTotalAmount}) desc`)
      .limit(TOP_PRODUCTS_LIMIT),

    // Point-in-time — NOT period-scoped. Read-only.
    queryLowStockVariants(lowStockThreshold),

    db.select({ value: count() }).from(reviews).where(eq(reviews.status, "pending")),
  ]);

  return {
    period,
    revenue: toMoney(revenueRow[0]?.total ?? "0", STORE_CURRENCY),
    orders: {
      // Orders created in the period, all statuses. A plain count — not a
      // funnel and not a confirmation rate.
      count: ordersCountRow[0]?.value ?? 0,
    },
    topProducts: topRows.map((r) => ({
      productId: r.productId,
      title: r.title,
      handle: r.handle,
      unitsSold: Number(r.unitsSold),
      revenue: toMoney(r.revenue, STORE_CURRENCY),
    })),
    lowStock: {
      threshold: lowStockThreshold,
      count: lowStockRows.length,
      items: lowStockRows.map((row) => ({
        variantId: row.product_variants.id,
        productId: row.product_variants.productId,
        productTitle: row.products.title,
        variantTitle: row.product_variants.title,
        handle: row.products.handle,
        sku: row.product_variants.sku,
        stock: row.product_variants.stock,
      })),
    },
    pendingReviews: {
      count: pendingReviewsRow[0]?.value ?? 0,
    },
  };
}
