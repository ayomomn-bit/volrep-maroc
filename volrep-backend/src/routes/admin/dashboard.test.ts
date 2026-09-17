import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin, seedOrder } from "../../test/admin.js";
import { seedProduct, seedVariant } from "../../test/seed.js";
import { closeDb } from "../../db/client.js";

describe("Admin dashboard summary", () => {
  let app: FastifyInstance;
  let session: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    session = (await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" })).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("requires an admin session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/dashboard" });
    expect(res.statusCode).toBe(401);
  });

  it("aggregates order counts, pending reviews and low-stock variants in one call", async () => {
    await seedOrder({ status: "pending_payment" });
    await seedOrder({ status: "pending_payment" });
    await seedOrder({ status: "paid" });
    await seedOrder({ status: "fulfilled" });

    const active = await seedProduct({ handle: "dash-active", status: "active" });
    await seedVariant(active.id, { title: "Low", stock: 2, availableForSale: true });
    await seedVariant(active.id, { title: "Fine", stock: 40, availableForSale: true });
    const draft = await seedProduct({ handle: "dash-draft", status: "draft" });
    await seedVariant(draft.id, { title: "Draft low", stock: 1 }); // not counted — product not active

    const res = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/dashboard" }));
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.orders).toMatchObject({ total: 4, pendingPayment: 2, paid: 1, fulfilled: 1 });
    // Seeded orders are created "now", so all four count toward today; the
    // paid + fulfilled ones are "being processed" / revenue-bearing.
    expect(body.orders.today).toBe(4);
    expect(body.orders.processing).toBe(1);
    expect(body.revenue.currencyCode).toBe("MAD");
    expect(Number(body.revenue.today)).toBeGreaterThan(0);
    expect(Number(body.revenue.allTime)).toBe(Number(body.revenue.today));
    expect(Array.isArray(body.recentOrders)).toBe(true);
    expect(body.recentOrders).toHaveLength(4);
    expect(body.recentOrders[0]).toHaveProperty("orderNumber");
    expect(body.reviews.pending).toBe(0);
    expect(body.inventory.lowStockThreshold).toBe(5);
    expect(body.inventory.lowStockCount).toBe(1);
    expect(body.inventory.lowStockVariants[0]).toMatchObject({ title: "Low", stock: 2, productHandle: "dash-active" });
  });

  it("honours a custom lowStockThreshold", async () => {
    const p = await seedProduct({ handle: "dash-thr", status: "active" });
    await seedVariant(p.id, { title: "A", stock: 8 });
    await seedVariant(p.id, { title: "B", stock: 20 });

    const res = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/dashboard?lowStockThreshold=10" }));
    expect(res.json().inventory.lowStockCount).toBe(1);
  });
});
