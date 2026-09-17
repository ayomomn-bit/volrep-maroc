import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { adminAuditLog, adminUsers, fulfillments, orderLineItems, orders } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminOrderDetail, mapAdminOrderSummary, type OrderTimelineEntry } from "../../mappers/admin.js";
import { allowedTransitionsFor, canTransition, type OrderStatus } from "../../lib/order-status.js";
import type { AdminContext } from "./auth.js";

export type { OrderStatus };
export { canTransition };

export type ListOrdersFilter = {
  status?: OrderStatus | undefined;
  orderNumber?: number | undefined;
  email?: string | undefined;
  // Free-text search across order number, email and phone.
  q?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  limit: number;
  offset: number;
};

export async function listOrders(filter: ListOrdersFilter) {
  const conditions = [];
  if (filter.status) conditions.push(eq(orders.status, filter.status));
  if (filter.orderNumber !== undefined) conditions.push(eq(orders.orderNumber, filter.orderNumber));
  if (filter.email) conditions.push(eq(sql`lower(${orders.email})`, filter.email.trim().toLowerCase()));
  if (filter.q?.trim()) {
    const like = `%${filter.q.trim().replace(/^#/, "")}%`;
    conditions.push(
      or(
        sql`${orders.orderNumber}::text ilike ${like}`,
        sql`${orders.email} ilike ${like}`,
        sql`${orders.phone} ilike ${like}`,
      ),
    );
  }
  if (filter.from) conditions.push(gte(orders.createdAt, filter.from));
  if (filter.to) conditions.push(lte(orders.createdAt, filter.to));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db.select().from(orders).where(where).orderBy(desc(orders.orderNumber)).limit(filter.limit).offset(filter.offset),
    db.select({ value: count() }).from(orders).where(where),
  ]);

  const itemCounts = rows.length
    ? await db
        .select({ orderId: orderLineItems.orderId, value: sql<number>`sum(${orderLineItems.quantity})::int` })
        .from(orderLineItems)
        .where(inArray(orderLineItems.orderId, rows.map((r) => r.id)))
        .groupBy(orderLineItems.orderId)
    : [];
  const countByOrder = new Map(itemCounts.map((r) => [r.orderId, r.value]));

  return {
    orders: rows.map((row) => mapAdminOrderSummary(row, countByOrder.get(row.id) ?? 0)),
    total: totalRow?.value ?? 0,
    limit: filter.limit,
    offset: filter.offset,
  };
}

async function loadOrderOr404(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw AppError.notFound("Order not found");
  return order;
}

export async function getOrderDetail(orderId: string) {
  const order = await loadOrderOr404(orderId);
  const [lines, [fulfillment]] = await Promise.all([
    db.select().from(orderLineItems).where(eq(orderLineItems.orderId, order.id)).orderBy(orderLineItems.createdAt),
    db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id)).orderBy(desc(fulfillments.createdAt)).limit(1),
  ]);
  const timeline = await buildOrderTimeline(order, fulfillment?.id ?? null);
  return mapAdminOrderDetail(order, lines, fulfillment ?? null, timeline);
}

function humanizeStatus(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function summarizeOrderEvent(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  switch (action) {
    case "order.status_change": {
      const from = typeof m.from === "string" ? humanizeStatus(m.from) : "?";
      const to = typeof m.to === "string" ? humanizeStatus(m.to) : "?";
      return `Status changed · ${from} → ${to}`;
    }
    case "fulfillment.create":
      return "Fulfillment created";
    case "fulfillment.update":
      return "Fulfillment updated";
    default:
      return humanizeStatus(action.replace(/\./g, " "));
  }
}

// Chronological (newest first) activity for one order: every audit row for
// the order and its fulfillment, plus a synthetic "placed" anchor. This is
// a read over the existing audit log — no new table, no new writes.
async function buildOrderTimeline(order: typeof orders.$inferSelect, fulfillmentId: string | null): Promise<OrderTimelineEntry[]> {
  const entityIds = fulfillmentId ? [order.id, fulfillmentId] : [order.id];
  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      metadata: adminAuditLog.metadata,
      createdAt: adminAuditLog.createdAt,
      email: adminUsers.email,
    })
    .from(adminAuditLog)
    .leftJoin(adminUsers, eq(adminAuditLog.adminUserId, adminUsers.id))
    .where(
      and(
        inArray(adminAuditLog.entityType, ["order", "fulfillment"]),
        inArray(adminAuditLog.entityId, entityIds),
      ),
    )
    .orderBy(desc(adminAuditLog.createdAt));

  const events: OrderTimelineEntry[] = rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    action: r.action,
    actorEmail: r.email ?? null,
    summary: summarizeOrderEvent(r.action, r.metadata),
    metadata: r.metadata,
  }));

  events.push({
    id: `placed:${order.id}`,
    at: order.createdAt.toISOString(),
    action: "order.placed",
    actorEmail: null,
    summary: "Order placed",
    metadata: null,
  });

  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export type TransitionInput = {
  to: OrderStatus;
  paymentReference?: string | undefined;
  note?: string | undefined;
};

export async function transitionOrderStatus(admin: AdminContext, orderId: string, input: TransitionInput) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw AppError.notFound("Order not found");

    const from = order.status as OrderStatus;
    if (from === input.to) {
      throw new AppError(409, "NO_STATUS_CHANGE", `Order is already ${from}.`);
    }
    if (!canTransition(from, input.to)) {
      throw new AppError(422, "INVALID_TRANSITION", `Cannot move an order from "${from}" to "${input.to}".`, {
        from,
        to: input.to,
        allowed: allowedTransitionsFor(from),
      });
    }

    const patch: Partial<typeof orders.$inferInsert> = { status: input.to, updatedAt: new Date() };
    // COD: reaching 'paid' is when cash was collected on delivery. Stamp
    // paidAt (once) and optionally the collector's reference note.
    if (input.to === "paid" && !order.paidAt) patch.paidAt = new Date();
    if (input.paymentReference !== undefined) patch.paymentReference = input.paymentReference;

    const [updated] = await tx.update(orders).set(patch).where(eq(orders.id, order.id)).returning();
    if (!updated) throw new Error("Order status update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "order.status_change",
      entityType: "order",
      entityId: order.id,
      metadata: {
        from,
        to: input.to,
        ...(input.paymentReference !== undefined ? { paymentReference: input.paymentReference } : {}),
        ...(input.note ? { note: input.note } : {}),
      },
    });

    const [lines, [fulfillment]] = await Promise.all([
      tx.select().from(orderLineItems).where(eq(orderLineItems.orderId, order.id)),
      tx.select().from(fulfillments).where(eq(fulfillments.orderId, order.id)).limit(1),
    ]);
    return mapAdminOrderDetail(updated, lines, fulfillment ?? null);
  });
}
