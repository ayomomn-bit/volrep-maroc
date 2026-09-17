import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { fulfillments, orders } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminFulfillment } from "../../mappers/admin.js";
import type { AdminContext } from "./auth.js";

export type FulfillmentStatus = "unfulfilled" | "fulfilled";

// `| undefined` on every optional key (not just `?`): Zod's
// `.optional()` output type includes undefined explicitly, and
// exactOptionalPropertyTypes treats "key may be undefined" and "key may
// be absent" as different declarations.
export type FulfillmentInput = {
  status?: FulfillmentStatus | undefined;
  carrier?: string | null | undefined;
  trackingNumber?: string | null | undefined;
  trackingUrl?: string | null | undefined;
  // Explicit shipped timestamp override; otherwise reaching 'fulfilled'
  // stamps it automatically.
  shippedAt?: string | null | undefined;
};

// V1 keeps exactly one fulfillment row per order — this matches the
// public GET /api/orders/track query, which reads a single fulfillment
// (src/services/orders.ts). Carrier integration is explicitly out of
// scope; every field here is manual admin entry.
async function loadOrderOr404(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw AppError.notFound("Order not found");
  return order;
}

async function existingFulfillment(orderId: string) {
  const [row] = await db
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId))
    .orderBy(desc(fulfillments.createdAt))
    .limit(1);
  return row ?? null;
}

function resolveShippedAt(input: FulfillmentInput, nextStatus: FulfillmentStatus, currentShippedAt: Date | null): Date | null {
  if (input.shippedAt !== undefined) return input.shippedAt ? new Date(input.shippedAt) : null;
  if (nextStatus === "fulfilled" && !currentShippedAt) return new Date();
  return currentShippedAt;
}

export async function createFulfillment(admin: AdminContext, orderId: string, input: FulfillmentInput) {
  await loadOrderOr404(orderId);
  if (await existingFulfillment(orderId)) {
    throw new AppError(409, "FULFILLMENT_EXISTS", "This order already has a fulfillment. Update it instead.");
  }

  const status = input.status ?? "unfulfilled";
  const shippedAt = resolveShippedAt(input, status, null);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(fulfillments)
      .values({
        orderId,
        status,
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
        trackingUrl: input.trackingUrl ?? null,
        shippedAt,
      })
      .returning();
    if (!row) throw new Error("Fulfillment insert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "fulfillment.create",
      entityType: "fulfillment",
      entityId: row.id,
      metadata: {
        orderId,
        status: row.status,
        carrier: row.carrier,
        trackingNumber: row.trackingNumber,
        trackingUrl: row.trackingUrl,
      },
    });

    return mapAdminFulfillment(row);
  });
}

export async function updateFulfillment(admin: AdminContext, orderId: string, input: FulfillmentInput) {
  await loadOrderOr404(orderId);
  const current = await existingFulfillment(orderId);
  if (!current) throw AppError.notFound("This order has no fulfillment yet. Create one first.");

  const nextStatus = input.status ?? (current.status as FulfillmentStatus);
  const shippedAt = resolveShippedAt(input, nextStatus, current.shippedAt);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(fulfillments)
      .set({
        status: nextStatus,
        carrier: input.carrier !== undefined ? input.carrier : current.carrier,
        trackingNumber: input.trackingNumber !== undefined ? input.trackingNumber : current.trackingNumber,
        trackingUrl: input.trackingUrl !== undefined ? input.trackingUrl : current.trackingUrl,
        shippedAt,
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, current.id))
      .returning();
    if (!row) throw new Error("Fulfillment update returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "fulfillment.update",
      entityType: "fulfillment",
      entityId: row.id,
      metadata: {
        orderId,
        before: {
          status: current.status,
          carrier: current.carrier,
          trackingNumber: current.trackingNumber,
          trackingUrl: current.trackingUrl,
        },
        after: {
          status: row.status,
          carrier: row.carrier,
          trackingNumber: row.trackingNumber,
          trackingUrl: row.trackingUrl,
        },
      },
    });

    return mapAdminFulfillment(row);
  });
}
