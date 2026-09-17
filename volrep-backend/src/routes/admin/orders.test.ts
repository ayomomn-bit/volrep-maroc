import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin, seedOrder } from "../../test/admin.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, fulfillments, orders } from "../../db/schema/index.js";

describe("Admin orders API", () => {
  let app: FastifyInstance;
  let session: string;
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    const admin = await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
    session = admin.sessionId;
    adminId = admin.id;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("lists orders, newest order-number first, with item counts and derived payment status", async () => {
    await seedOrder({ email: "a@example.test" });
    await seedOrder({ email: "b@example.test", quantity: 3 });

    const res = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/orders" }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.orders[0].orderNumber).toBe("#1002");
    expect(body.orders[0].itemCount).toBe(3);
    expect(body.orders[0].paymentStatus).toBe("pending");
    // no internal secrets
    expect(JSON.stringify(body)).not.toMatch(/checkoutSessionId|passwordHash|internal/i);
  });

  it("filters by status, order number and email", async () => {
    const paid = await seedOrder({ email: "paid@example.test", status: "paid" });
    await seedOrder({ email: "pending@example.test" });

    const byStatus = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/orders?status=paid" }));
    expect(byStatus.json().orders.map((o: { email: string }) => o.email)).toEqual(["paid@example.test"]);

    const byNumber = await app.inject(
      asAdmin(session, { method: "GET", url: `/api/admin/orders?orderNumber=${paid.orderNumber}` }),
    );
    expect(byNumber.json().orders).toHaveLength(1);

    const byEmail = await app.inject(
      asAdmin(session, { method: "GET", url: "/api/admin/orders?email=PENDING@example.test" }),
    );
    expect(byEmail.json().orders).toHaveLength(1);
    expect(byEmail.json().orders[0].email).toBe("pending@example.test");
  });

  it("returns full order detail with line items, customer info and amounts", async () => {
    const { orderId } = await seedOrder({ email: "detail@example.test", quantity: 2, unitPrice: "100.00" });

    const res = await app.inject(asAdmin(session, { method: "GET", url: `/api/admin/orders/${orderId}` }));
    expect(res.statusCode).toBe(200);
    const { order } = res.json();
    expect(order.customer).toEqual({ email: "detail@example.test", phone: "+212600000000" });
    expect(order.amounts.total).toEqual({ amount: "200.00", currencyCode: "MAD" });
    expect(order.lineItems).toHaveLength(1);
    expect(order.lineItems[0]).toMatchObject({ quantity: 2, unitPrice: { amount: "100.00", currencyCode: "MAD" } });
    expect(order.fulfillment).toBeNull();
    // The admin UI reads this to decide which transition buttons to show.
    expect(order.allowedTransitions).toEqual(["paid", "canceled"]);
  });

  it("performs a valid status transition (pending_payment -> paid) and stamps paidAt + audits it", async () => {
    const { orderId } = await seedOrder();

    const res = await app.inject(
      asAdmin(session, {
        method: "PATCH",
        url: `/api/admin/orders/${orderId}/status`,
        payload: { status: "paid", paymentReference: "CASH-01", note: "collected on delivery" },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().order.status).toBe("paid");
    expect(res.json().order.payment.paidAt).not.toBeNull();
    expect(res.json().order.payment.reference).toBe("CASH-01");

    const [audit] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "order.status_change"));
    expect(audit).toMatchObject({ adminUserId: adminId, entityType: "order", entityId: orderId });
    expect(audit?.metadata).toMatchObject({ from: "pending_payment", to: "paid" });
  });

  it("rejects an invalid transition (422) and an unknown status string (400)", async () => {
    const { orderId } = await seedOrder({ status: "paid" });

    const bad = await app.inject(
      asAdmin(session, {
        method: "PATCH",
        url: `/api/admin/orders/${orderId}/status`,
        payload: { status: "pending_payment" },
      }),
    );
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe("INVALID_TRANSITION");

    const garbage = await app.inject(
      asAdmin(session, {
        method: "PATCH",
        url: `/api/admin/orders/${orderId}/status`,
        payload: { status: "shipped_somewhere" },
      }),
    );
    expect(garbage.statusCode).toBe(400);

    // nothing changed
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row?.status).toBe("paid");
  });

  it("creates a fulfillment with manual tracking, then rejects a second create", async () => {
    const { orderId } = await seedOrder({ status: "paid" });

    const created = await app.inject(
      asAdmin(session, {
        method: "POST",
        url: `/api/admin/orders/${orderId}/fulfillment`,
        payload: { status: "fulfilled", carrier: "CTM", trackingNumber: "T123", trackingUrl: "https://track.test/T123" },
      }),
    );
    expect(created.statusCode).toBe(201);
    expect(created.json().fulfillment).toMatchObject({ status: "fulfilled", carrier: "CTM", trackingNumber: "T123" });
    expect(created.json().fulfillment.shippedAt).not.toBeNull();

    const again = await app.inject(
      asAdmin(session, { method: "POST", url: `/api/admin/orders/${orderId}/fulfillment`, payload: { status: "unfulfilled" } }),
    );
    expect(again.statusCode).toBe(409);
  });

  it("makes tracking visible on the PUBLIC GET /api/orders/track after the admin sets it", async () => {
    const { orderId, orderNumber, email } = await seedOrder({ status: "paid" });

    // Before: not available yet.
    const before = await app.inject(
      withAuth({ method: "GET", url: `/api/orders/track?orderNumber=${orderNumber}&email=${encodeURIComponent(email)}` }),
    );
    expect(before.json().order.fulfillment).toBeNull();

    await app.inject(
      asAdmin(session, {
        method: "POST",
        url: `/api/admin/orders/${orderId}/fulfillment`,
        payload: { status: "fulfilled", carrier: "CTM", trackingNumber: "TRACK-9", trackingUrl: "https://track.test/9" },
      }),
    );

    const after = await app.inject(
      withAuth({ method: "GET", url: `/api/orders/track?orderNumber=${orderNumber}&email=${encodeURIComponent(email)}` }),
    );
    expect(after.json().order.fulfillment).toEqual({
      carrier: "CTM",
      trackingNumber: "TRACK-9",
      trackingUrl: "https://track.test/9",
    });
    // Public tracking still leaks nothing internal.
    expect(JSON.stringify(after.json())).not.toMatch(/email|phone|paymentReference|shippingAddress|adminUser/i);
  });

  it("updates an existing fulfillment and audits the before/after", async () => {
    const { orderId } = await seedOrder({ status: "paid" });
    await app.inject(
      asAdmin(session, { method: "POST", url: `/api/admin/orders/${orderId}/fulfillment`, payload: {} }),
    );

    const res = await app.inject(
      asAdmin(session, {
        method: "PATCH",
        url: `/api/admin/orders/${orderId}/fulfillment`,
        payload: { status: "fulfilled", trackingNumber: "UPDATED-1" },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().fulfillment).toMatchObject({ status: "fulfilled", trackingNumber: "UPDATED-1" });

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "fulfillment.update"));
    expect(audit?.metadata).toMatchObject({ after: { trackingNumber: "UPDATED-1" } });
  });

  // Security hardening — Step 4 M5: order MUTATIONS are owner-only. Read
  // access stays staff-ok. Enforced server-side by `requireOwner` on each
  // mutation route (the admin UI drives none of these — COD system owns
  // order ops — so this is purely the authorization boundary).
  describe("order-status authorization (M5)", () => {
    let staff: string;

    beforeEach(async () => {
      staff = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
    });

    it("lets staff READ orders (list + detail) — read access is unchanged", async () => {
      const { orderId } = await seedOrder({ email: "read@example.test" });

      const list = await app.inject(asAdmin(staff, { method: "GET", url: "/api/admin/orders" }));
      expect(list.statusCode).toBe(200);
      expect(list.json().total).toBe(1);

      const detail = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/orders/${orderId}` }));
      expect(detail.statusCode).toBe(200);
      expect(detail.json().order.customer.email).toBe("read@example.test");
    });

    it("blocks staff from a status transition (403 FORBIDDEN) and leaves the order + audit untouched", async () => {
      const { orderId } = await seedOrder();

      const res = await app.inject(
        asAdmin(staff, {
          method: "PATCH",
          url: `/api/admin/orders/${orderId}/status`,
          payload: { status: "paid", paymentReference: "CASH-99", note: "sneaky" },
        }),
      );
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");

      // No mutation side effects: status, paidAt, payment reference, audit.
      const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(row?.status).toBe("pending_payment");
      expect(row?.paidAt).toBeNull();
      expect(row?.paymentReference).toBeNull();
      const audits = await db
        .select()
        .from(adminAuditLog)
        .where(eq(adminAuditLog.action, "order.status_change"));
      expect(audits).toHaveLength(0);
    });

    it("blocks staff from creating or updating a fulfillment (403) with no fulfillment row written", async () => {
      const { orderId } = await seedOrder({ status: "paid" });

      const create = await app.inject(
        asAdmin(staff, {
          method: "POST",
          url: `/api/admin/orders/${orderId}/fulfillment`,
          payload: { status: "fulfilled", carrier: "CTM", trackingNumber: "NOPE" },
        }),
      );
      expect(create.statusCode).toBe(403);
      expect(create.json().error.code).toBe("FORBIDDEN");

      const update = await app.inject(
        asAdmin(staff, {
          method: "PATCH",
          url: `/api/admin/orders/${orderId}/fulfillment`,
          payload: { status: "fulfilled" },
        }),
      );
      expect(update.statusCode).toBe(403);

      expect(await db.select().from(fulfillments).where(eq(fulfillments.orderId, orderId))).toHaveLength(0);
      const audits = await db
        .select()
        .from(adminAuditLog)
        .where(eq(adminAuditLog.entityType, "fulfillment"));
      expect(audits).toHaveLength(0);
    });

    it("still rejects an UNAUTHENTICATED mutation with 401 (auth unchanged, checked before role)", async () => {
      const { orderId } = await seedOrder();

      const noCookie = await app.inject({
        method: "PATCH",
        url: `/api/admin/orders/${orderId}/status`,
        payload: { status: "paid" },
      });
      expect(noCookie.statusCode).toBe(401);
      expect(noCookie.json().error.code).toBe("UNAUTHORIZED");

      const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(row?.status).toBe("pending_payment");
    });

    it("still lets an OWNER perform every order mutation (authorized path intact)", async () => {
      const { orderId } = await seedOrder();

      const status = await app.inject(
        asAdmin(session, {
          method: "PATCH",
          url: `/api/admin/orders/${orderId}/status`,
          payload: { status: "paid" },
        }),
      );
      expect(status.statusCode).toBe(200);
      expect(status.json().order.status).toBe("paid");

      const fulfil = await app.inject(
        asAdmin(session, {
          method: "POST",
          url: `/api/admin/orders/${orderId}/fulfillment`,
          payload: { status: "fulfilled", carrier: "CTM" },
        }),
      );
      expect(fulfil.statusCode).toBe(201);
    });
  });
});
