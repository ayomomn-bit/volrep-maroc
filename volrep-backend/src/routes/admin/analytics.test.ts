import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedProduct, seedVariant } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { carts, checkoutSessions, orderLineItems, orders, reviews } from "../../db/schema/index.js";

type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "partially_fulfilled"
  | "canceled"
  | "refunded"
  | "partially_refunded";

// Places a complete order against an existing variant, mirroring
// src/test/admin.ts seedOrder but reusing one product so top-product
// aggregation can be exercised. `ageDays` back-dates created_at.
async function placeOrder(opts: {
  variantId: string;
  productTitle: string;
  quantity?: number;
  unitPrice?: string;
  status?: OrderStatus;
  ageDays?: number;
}) {
  const quantity = opts.quantity ?? 1;
  const unitPrice = opts.unitPrice ?? "899.00";
  const lineTotal = (Number(unitPrice) * quantity).toFixed(2);
  const createdAt = opts.ageDays ? new Date(Date.now() - opts.ageDays * 24 * 60 * 60 * 1000) : new Date();

  const [cart] = await db.insert(carts).values({ status: "converted", expiresAt: new Date(Date.now() + 86_400_000) }).returning();
  const [session] = await db
    .insert(checkoutSessions)
    .values({
      cartId: cart!.id,
      provider: "cod",
      providerSessionId: crypto.randomUUID(),
      status: "completed",
      amountTotal: lineTotal,
      currency: "MAD",
      shippingAddress: {},
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const [order] = await db
    .insert(orders)
    .values({
      checkoutSessionId: session!.id,
      email: "buyer@example.test",
      phone: "+212600000000",
      status: opts.status ?? "paid",
      subtotalAmount: lineTotal,
      shippingAmount: "0",
      totalAmount: lineTotal,
      currency: "MAD",
      shippingAddress: {},
      paymentProvider: "cod",
      createdAt,
    })
    .returning();
  await db.insert(orderLineItems).values({
    orderId: order!.id,
    variantId: opts.variantId,
    productTitle: opts.productTitle,
    variantTitle: "Default",
    sku: null,
    quantity,
    unitPriceAmount: unitPrice,
    lineTotalAmount: lineTotal,
  });
  return order!;
}

describe("Admin store analytics (read-only)", () => {
  let app: FastifyInstance;
  let owner: string;
  let staff: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    owner = (await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" })).sessionId;
    staff = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/analytics" });
    expect(res.statusCode).toBe(401);
  });

  it("is readable by staff and by owner", async () => {
    for (const session of [staff, owner]) {
      const res = await app.inject(asAdmin(session, { method: "GET", url: "/api/admin/analytics" }));
      expect(res.statusCode).toBe(200);
    }
  });

  it("returns a clean zero state when there is no data", async () => {
    const res = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      period: "30d",
      revenue: { amount: "0.00", currencyCode: "MAD" },
      orders: { count: 0 },
      topProducts: [],
      lowStock: { threshold: 5, count: 0, items: [] },
      pendingReviews: { count: 0 },
    });
  });

  it("aggregates revenue and order count from revenue-bearing orders, excluding pending/canceled", async () => {
    const p = await seedProduct({ handle: "an-prm", status: "active" });
    const v = await seedVariant(p.id, { title: "Default", stock: 50 });

    await placeOrder({ variantId: v.id, productTitle: p.title, status: "paid", unitPrice: "899.00" });
    await placeOrder({ variantId: v.id, productTitle: p.title, status: "fulfilled", unitPrice: "899.00" });
    await placeOrder({ variantId: v.id, productTitle: p.title, status: "pending_payment", unitPrice: "899.00" });
    await placeOrder({ variantId: v.id, productTitle: p.title, status: "canceled", unitPrice: "899.00" });

    const res = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics" }));
    const body = res.json();
    // orders.count = ALL orders in the period (4), revenue only the 2 paid/fulfilled
    expect(body.orders.count).toBe(4);
    expect(body.revenue.amount).toBe("1798.00");
    expect(body.topProducts).toHaveLength(1);
    expect(body.topProducts[0]).toMatchObject({ title: "VOLREP PRM", handle: "an-prm", unitsSold: 2, revenue: { amount: "1798.00" } });
  });

  it("ranks top products by revenue and caps the list at 5", async () => {
    for (let i = 0; i < 7; i++) {
      const p = await seedProduct({ handle: `an-top-${i}`, title: `Product ${i}`, status: "active" });
      const v = await seedVariant(p.id, { stock: 100 });
      // Product 6 sells the most, Product 0 the least.
      await placeOrder({ variantId: v.id, productTitle: p.title, status: "paid", quantity: i + 1, unitPrice: "100.00" });
    }
    const res = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics" }));
    const top = res.json().topProducts;
    expect(top).toHaveLength(5);
    expect(top[0].title).toBe("Product 6");
    expect(top[0].unitsSold).toBe(7);
    expect(top.map((r: { title: string }) => r.title)).toEqual(["Product 6", "Product 5", "Product 4", "Product 3", "Product 2"]);
  });

  it("scopes revenue / orders / top products to the period, but not low stock or pending reviews", async () => {
    const p = await seedProduct({ handle: "an-period", status: "active" });
    const v = await seedVariant(p.id, { title: "Default", stock: 2 }); // low stock now

    await placeOrder({ variantId: v.id, productTitle: p.title, status: "paid", ageDays: 2 }); // within 7d
    await placeOrder({ variantId: v.id, productTitle: p.title, status: "paid", ageDays: 20 }); // within 30d only
    await placeOrder({ variantId: v.id, productTitle: p.title, status: "paid", ageDays: 90 }); // all-time only

    await db.insert(reviews).values({ productId: p.id, author: "X", rating: 3, body: "y", status: "pending" });

    const d7 = (await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics?period=7d" }))).json();
    const d30 = (await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics?period=30d" }))).json();
    const all = (await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics?period=all" }))).json();

    expect(d7.orders.count).toBe(1);
    expect(d30.orders.count).toBe(2);
    expect(all.orders.count).toBe(3);
    expect(d7.topProducts[0].unitsSold).toBe(1);
    expect(all.topProducts[0].unitsSold).toBe(3);

    // point-in-time metrics identical across every period
    for (const d of [d7, d30, all]) {
      expect(d.lowStock.count).toBe(1);
      expect(d.pendingReviews.count).toBe(1);
    }
  });

  it("reports low stock for active purchasable variants only, honouring a custom threshold", async () => {
    const active = await seedProduct({ handle: "an-active", status: "active" });
    await seedVariant(active.id, { title: "Low", stock: 3, availableForSale: true });
    await seedVariant(active.id, { title: "Plenty", stock: 40, availableForSale: true });
    await seedVariant(active.id, { title: "Hidden", stock: 1, availableForSale: false });
    const draft = await seedProduct({ handle: "an-draft", status: "draft" });
    await seedVariant(draft.id, { title: "Draft low", stock: 1 });

    const def = (await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics" }))).json();
    expect(def.lowStock.count).toBe(1);
    expect(def.lowStock.items[0]).toMatchObject({ variantTitle: "Low", stock: 3, handle: "an-active" });
    // no PII fields
    expect(JSON.stringify(def)).not.toContain("buyer@example.test");
    expect(JSON.stringify(def)).not.toContain("+212");

    const wide = (await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics?lowStockThreshold=45" }))).json();
    expect(wide.lowStock.count).toBe(2);
  });

  it("counts pending reviews only (approved / rejected excluded)", async () => {
    const p = await seedProduct({ handle: "an-rev", status: "active" });
    await db.insert(reviews).values([
      { productId: p.id, author: "A", rating: 5, body: "x", status: "pending" },
      { productId: p.id, author: "B", rating: 4, body: "y", status: "pending" },
      { productId: p.id, author: "C", rating: 1, body: "z", status: "approved" },
      { productId: p.id, author: "D", rating: 2, body: "w", status: "rejected" },
    ]);
    const res = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics" }));
    expect(res.json().pendingReviews.count).toBe(2);
  });

  it("does not break for a product with no variants and never mutates data", async () => {
    await seedProduct({ handle: "an-novariant", status: "active" });
    const before = await db.select().from(orders);

    const res = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().topProducts).toEqual([]);
    expect(res.json().lowStock.count).toBe(0);

    const after = await db.select().from(orders);
    expect(after.length).toBe(before.length);
  });

  it("rejects an unknown period and unknown query fields", async () => {
    const badPeriod = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics?period=1y" }));
    expect(badPeriod.statusCode).toBe(400);
    const badField = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/analytics?customerEmail=x" }));
    expect(badField.statusCode).toBe(400);
  });

  it("has no mutating verb on the route", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const res = await app.inject(asAdmin(owner, { method, url: "/api/admin/analytics" }));
      expect(res.statusCode).toBe(404);
    }
  });
});
