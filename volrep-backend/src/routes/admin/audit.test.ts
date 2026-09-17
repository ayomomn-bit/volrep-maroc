import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin, seedOrder } from "../../test/admin.js";
import { seedProduct, seedShipping, seedVariant } from "../../test/seed.js";
import { closeDb } from "../../db/client.js";

// End-to-end: exercise one important mutation from every admin domain and
// assert the audit log ends up with a coherent, secret-free trail.
describe("Admin audit log", () => {
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

  it("records every important mutation, attributed to the acting admin, with no secrets", async () => {
    await seedShipping({ countryCode: "MA" });
    const product = await seedProduct({ handle: "audit-prod", status: "draft" });
    const variant = await seedVariant(product.id, { stock: 10 });
    const { orderId } = await seedOrder({ status: "paid" });

    // one mutation per domain
    await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { status: "active" } }),
    );
    await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/variants/${variant.id}`, payload: { priceAmount: "12.00" } }),
    );
    await app.inject(
      asAdmin(session, {
        method: "POST",
        url: `/api/admin/variants/${variant.id}/inventory`,
        payload: { mode: "set", quantity: 3, reason: "count" },
      }),
    );
    await app.inject(
      asAdmin(session, {
        method: "POST",
        url: `/api/admin/orders/${orderId}/fulfillment`,
        payload: { status: "fulfilled", trackingNumber: "X1" },
      }),
    );
    await app.inject(
      asAdmin(session, { method: "PATCH", url: `/api/admin/orders/${orderId}/status`, payload: { status: "fulfilled" } }),
    );
    await app.inject(
      asAdmin(session, {
        method: "PUT",
        url: "/api/admin/shipping-settings/MA",
        payload: { flatRateAmount: "25.00" },
      }),
    );

    const res = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/audit-log?limit=100" }));
    expect(res.statusCode).toBe(200);
    const actions = res.json().entries.map((e: { action: string }) => e.action);

    for (const expected of [
      "admin.login",
      "product.status_change",
      "variant.update",
      "inventory.adjust",
      "fulfillment.create",
      "order.status_change",
      "shipping.update",
    ]) {
      expect(actions).toContain(expected);
    }

    // all attributed to the acting admin
    for (const entry of res.json().entries) {
      expect(entry.adminUserId).toBe(adminId);
      expect(entry.createdAt).toBeDefined();
      expect(entry.entityId).toMatch(/^[0-9a-f-]{36}$/);
    }

    // no credential material anywhere in the trail
    expect(JSON.stringify(res.json())).not.toMatch(/\$argon2|passwordHash|password_hash|x-internal-api-key|session/i);

    // filtering works
    const filtered = await app.inject(
      asAdmin(session, { method: "GET", url: `/api/admin/audit-log?entityType=order&entityId=${orderId}` }),
    );
    expect(filtered.json().entries.length).toBeGreaterThan(0);
    for (const entry of filtered.json().entries) {
      expect(entry.entityType).toBe("order");
      expect(entry.entityId).toBe(orderId);
    }
  });
});
