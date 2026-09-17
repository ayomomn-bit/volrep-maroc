import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireOwner, adminOf } from "../../plugins/admin-auth.js";
import { getOrderDetail, listOrders, transitionOrderStatus, type OrderStatus } from "../../services/admin/orders.js";
import { createFulfillment, updateFulfillment } from "../../services/admin/fulfillment.js";

const ORDER_STATUS = [
  "pending_payment",
  "paid",
  "fulfilled",
  "partially_fulfilled",
  "canceled",
  "refunded",
  "partially_refunded",
] as const;

const listQuerySchema = z
  .object({
    status: z.enum(ORDER_STATUS).optional(),
    orderNumber: z
      .string()
      .regex(/^#?\d{1,10}$/)
      .transform((v) => Number(v.replace(/^#/, "")))
      .optional(),
    email: z.string().email().optional(),
    q: z.string().trim().min(1).max(120).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const idParams = z.object({ id: z.string().uuid() });

const statusBodySchema = z
  .object({
    status: z.enum(ORDER_STATUS),
    paymentReference: z.string().max(200).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

const fulfillmentBodySchema = z
  .object({
    status: z.enum(["unfulfilled", "fulfilled"]).optional(),
    carrier: z.string().max(120).nullable().optional(),
    trackingNumber: z.string().max(200).nullable().optional(),
    trackingUrl: z.string().url().max(2000).nullable().optional(),
    shippedAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function adminOrderRoutes(app: FastifyInstance): Promise<void> {
  // Read access (list + detail) is STAFF-ok — same tier as dashboard /
  // analytics / audit-log. Every order MUTATION below is OWNER-only
  // (`requireOwner` on top of this hook): moving an order's status
  // (payment / cancellation / refund state) or its fulfillment /
  // tracking is a financial + customer-facing action, so it sits with
  // the other owner-only writes (product status, shipping, store
  // settings). The admin UI drives none of these today — order
  // operations live in the separate COD system (Phase 7C-1) — this is
  // purely the server-side authorization boundary (security hardening —
  // Step 4 M5).
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/orders", async (request) => {
    const q = listQuerySchema.parse(request.query);
    return listOrders({
      status: q.status as OrderStatus | undefined,
      orderNumber: q.orderNumber,
      email: q.email,
      q: q.q,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit,
      offset: q.offset,
    });
  });

  app.get("/api/admin/orders/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return { order: await getOrderDetail(id) };
  });

  app.patch("/api/admin/orders/:id/status", { preHandler: requireOwner }, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = statusBodySchema.parse(request.body);
    return {
      order: await transitionOrderStatus(adminOf(request), id, {
        to: body.status,
        ...(body.paymentReference !== undefined ? { paymentReference: body.paymentReference } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      }),
    };
  });

  app.post("/api/admin/orders/:id/fulfillment", { preHandler: requireOwner }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = fulfillmentBodySchema.parse(request.body);
    reply.status(201);
    return { fulfillment: await createFulfillment(adminOf(request), id, body) };
  });

  app.patch("/api/admin/orders/:id/fulfillment", { preHandler: requireOwner }, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = fulfillmentBodySchema.parse(request.body);
    return { fulfillment: await updateFulfillment(adminOf(request), id, body) };
  });
}
