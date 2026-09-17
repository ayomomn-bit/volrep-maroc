import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct, seedShipping, seedVariant } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { fulfillments, orders } from "../db/schema/index.js";

describe("Order Tracking API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    await seedShipping({ countryCode: "MA", flatRateAmount: "0" });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeDb();
  });

  async function placeOrder(email: string) {
    const product = await seedProduct({ handle: `p-${crypto.randomUUID()}` });
    const variant = await seedVariant(product.id, { priceAmount: "150.00", stock: 5 });
    const add = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const cartId = add.json().cart.id;
    const checkout = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId, email, phone: "+212600000000", shippingAddress: { line1: "1 St", city: "Rabat", country: "MA" } },
      }),
    );
    return checkout.json().order as { id: string; orderNumber: string };
  }

  it("finds an order with the correct order number and email", async () => {
    const order = await placeOrder("buyer@example.com");
    const numberOnly = order.orderNumber.replace("#", "");

    const response = await app.inject(
      withAuth({ method: "GET", url: `/api/orders/track?orderNumber=${numberOnly}&email=buyer@example.com` }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("found");
    expect(body.order.name).toBe(order.orderNumber);
    expect(body.order.status).toBe("Pending Payment");
    expect(body.order.lineItems).toEqual([{ title: "VOLREP PRM", quantity: 1 }]);
    expect(body.order.fulfillment).toBeNull();
  });

  it("matches case-insensitively on email", async () => {
    const order = await placeOrder("buyer@example.com");
    const response = await app.inject(
      withAuth({
        method: "GET",
        url: `/api/orders/track?orderNumber=${order.orderNumber.replace("#", "")}&email=BUYER@EXAMPLE.COM`,
      }),
    );
    expect(response.json().status).toBe("found");
  });

  it("returns not_found for the right number but wrong email — never an existence oracle", async () => {
    const order = await placeOrder("buyer@example.com");
    const response = await app.inject(
      withAuth({
        method: "GET",
        url: `/api/orders/track?orderNumber=${order.orderNumber.replace("#", "")}&email=someone-else@example.com`,
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "not_found" });
  });

  it("returns the identical not_found shape for a nonexistent order number", async () => {
    const response = await app.inject(
      withAuth({ method: "GET", url: "/api/orders/track?orderNumber=999999&email=nobody@example.com" }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "not_found" });
  });

  it("returns fulfillment/tracking information once an admin has fulfilled the order", async () => {
    const order = await placeOrder("buyer@example.com");
    await db.insert(fulfillments).values({
      orderId: order.id,
      status: "fulfilled",
      carrier: "Amana",
      trackingNumber: "MA123456789",
      trackingUrl: "https://tracking.example.com/MA123456789",
    });
    await db.update(orders).set({ status: "fulfilled" }).where(eq(orders.id, order.id));

    const response = await app.inject(
      withAuth({ method: "GET", url: `/api/orders/track?orderNumber=${order.orderNumber.replace("#", "")}&email=buyer@example.com` }),
    );

    const body = response.json();
    expect(body.order.status).toBe("Fulfilled");
    expect(body.order.fulfillment).toEqual({
      carrier: "Amana",
      trackingNumber: "MA123456789",
      trackingUrl: "https://tracking.example.com/MA123456789",
    });
  });

  it("never exposes internal ids, payment reference, or the shipping address", async () => {
    const order = await placeOrder("buyer@example.com");
    const response = await app.inject(
      withAuth({ method: "GET", url: `/api/orders/track?orderNumber=${order.orderNumber.replace("#", "")}&email=buyer@example.com` }),
    );
    const raw = JSON.stringify(response.json());
    expect(raw).not.toContain(order.id);
    expect(raw.toLowerCase()).not.toContain("shippingaddress");
    expect(raw.toLowerCase()).not.toContain("paymentreference");
    expect(raw.toLowerCase()).not.toContain("email");
  });

  it("rejects a malformed order number", async () => {
    const response = await app.inject(
      withAuth({ method: "GET", url: "/api/orders/track?orderNumber=not-a-number&email=a@example.com" }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rate-limits repeated tracking attempts", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 9 }, () =>
        app.inject(withAuth({ method: "GET", url: "/api/orders/track?orderNumber=1001&email=a@example.com" })),
      ),
    );
    expect(attempts.some((r) => r.statusCode === 429)).toBe(true);
  });

  // ---- Step 4 H2: the per-route limiter keys on the FORWARDED client IP --

  const TRACK_URL = "/api/orders/track?orderNumber=1001&email=a@example.com";

  it("does not conflate 9 distinct forwarded client IPs into one bucket", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 9 }, (_unused, i) =>
        app.inject(
          withAuth({
            method: "GET",
            url: TRACK_URL,
            remoteAddress: "127.0.0.1", // the co-located reverse proxy (trusted)
            headers: { "x-forwarded-for": `41.92.${i}.5` }, // a distinct real customer each time
          }),
        ),
      ),
    );
    // One hit per forwarded IP, max is 8 → nobody is rate-limited.
    expect(attempts.every((r) => r.statusCode !== 429)).toBe(true);
  });

  it("rate-limits repeated tracking from the SAME forwarded IP after the threshold", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await app.inject(
        withAuth({
          method: "GET",
          url: TRACK_URL,
          remoteAddress: "127.0.0.1",
          headers: { "x-forwarded-for": "203.0.113.77" },
        }),
      );
      codes.push(res.statusCode);
    }
    expect(codes).toContain(429); // 8 / 10 min per real IP
  });

  it("ignores a spoofed X-Forwarded-For from an untrusted socket (keys on the socket IP)", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await app.inject(
        withAuth({
          method: "GET",
          url: TRACK_URL,
          remoteAddress: "198.51.100.9", // NOT loopback → not a trusted proxy
          headers: { "x-forwarded-for": `10.0.0.${i}` }, // rotated spoof — must be ignored
        }),
      );
      codes.push(res.statusCode);
    }
    // All 10 collapse onto the real socket IP → the spoof cannot rotate the key.
    expect(codes).toContain(429);
  });
});
