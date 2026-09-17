import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orders, productVariants, products, reviews } from "../../db/schema/index.js";
import { mapAdminVariant } from "../../mappers/admin.js";
import { listOrders } from "./orders.js";

// Default "low stock" threshold. Overridable per request so an admin can
// widen/narrow it without a code change; there is no configured reorder
// point in the schema yet.
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

// Order statuses that represent cash actually collected (COD): the order
// reached at least "paid". Full refunds and cancellations are excluded;
// a partial refund still nets positive so it stays in. Exported so the
// analytics endpoint reuses the exact same "revenue" definition rather
// than inventing its own.
export const REVENUE_STATUSES = ["paid", "fulfilled", "partially_fulfilled", "partially_refunded"] as const;

// "Being processed" = paid but not yet fully shipped.
const PROCESSING_STATUSES = ["paid", "partially_fulfilled"] as const;

const RECENT_ORDERS_LIMIT = 8;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Informational low-stock read: variants of ACTIVE, purchasable products
// at or below `threshold` units. Volrep never mutates stock — this is the
// one shared query behind both the dashboard and the analytics view.
export function queryLowStockVariants(threshold: number) {
  return db
    .select()
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.status, "active"),
        eq(productVariants.availableForSale, true),
        lte(productVariants.stock, threshold),
      ),
    )
    .orderBy(sql`${productVariants.stock} asc`)
    .limit(50);
}

// One round trip for the whole dashboard home — the alternative is ~10
// separate list calls just to read their aggregates (Phase 7B/7C brief:
// prefer a small aggregate endpoint over many inefficient requests).
export async function getDashboardSummary(lowStockThreshold: number) {
  const todayStart = startOfToday();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orderCounts, todayRow, processingRow, revenueRow, reviewPending, recent, lowStockRows] = await Promise.all([
    db.select({ status: orders.status, value: count() }).from(orders).groupBy(orders.status),
    db.select({ value: count() }).from(orders).where(gte(orders.createdAt, todayStart)),
    db.select({ value: count() }).from(orders).where(inArray(orders.status, [...PROCESSING_STATUSES])),
    db
      .select({
        today: sql<string>`coalesce(sum(${orders.totalAmount}) filter (where ${orders.createdAt} >= ${todayStart.toISOString()}::timestamptz), 0)::text`,
        last30Days: sql<string>`coalesce(sum(${orders.totalAmount}) filter (where ${orders.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz), 0)::text`,
        allTime: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`,
      })
      .from(orders)
      .where(inArray(orders.status, [...REVENUE_STATUSES])),
    db.select({ value: count() }).from(reviews).where(eq(reviews.status, "pending")),
    listOrders({ limit: RECENT_ORDERS_LIMIT, offset: 0 }),
    queryLowStockVariants(lowStockThreshold),
  ]);

  const byStatus = new Map(orderCounts.map((r) => [r.status, r.value]));
  const totalOrders = orderCounts.reduce((sum, r) => sum + r.value, 0);

  return {
    orders: {
      total: totalOrders,
      today: todayRow[0]?.value ?? 0,
      pendingPayment: byStatus.get("pending_payment") ?? 0,
      processing: processingRow[0]?.value ?? 0,
      paid: byStatus.get("paid") ?? 0,
      fulfilled: byStatus.get("fulfilled") ?? 0,
      partiallyFulfilled: byStatus.get("partially_fulfilled") ?? 0,
      canceled: byStatus.get("canceled") ?? 0,
      refunded: (byStatus.get("refunded") ?? 0) + (byStatus.get("partially_refunded") ?? 0),
    },
    revenue: {
      currencyCode: "MAD",
      today: revenueRow[0]?.today ?? "0",
      last30Days: revenueRow[0]?.last30Days ?? "0",
      allTime: revenueRow[0]?.allTime ?? "0",
    },
    recentOrders: recent.orders,
    reviews: { pending: reviewPending[0]?.value ?? 0 },
    inventory: {
      lowStockThreshold,
      lowStockCount: lowStockRows.length,
      lowStockVariants: lowStockRows.map((row) => ({
        ...mapAdminVariant(row.product_variants),
        productTitle: row.products.title,
        productHandle: row.products.handle,
      })),
    },
  };
}
