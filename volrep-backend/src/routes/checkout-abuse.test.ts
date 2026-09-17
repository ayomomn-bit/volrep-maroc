import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct, seedShipping, seedVariant } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { orders, productVariants } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

// Step 1C / 1D / 1E — anti-abuse protection on the public COD order
// endpoint. The test env keeps the defaults: TRUST_PROXY="loopback",
// COD_ORDER_IP_MAX=20, COD_ORDER_PHONE_MAX=5.
describe("COD Checkout — abuse protection", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    await seedShipping({ countryCode: "MA", flatRateAmount: "30.00" });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeDb();
  });

  const validAddress = { line1: "1 Test St", city: "Casablanca", country: "MA" };

  async function seedCart(quantity = 1, variantOverrides: Parameters<typeof seedVariant>[1] = {}) {
    const product = await seedProduct({ handle: `volrep-prm-${crypto.randomUUID()}` });
    const variant = await seedVariant(product.id, { priceAmount: "100.00", stock: 500, ...variantOverrides });
    const add = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity } }),
    );
    return { cartId: add.json().cart.id as string, variant };
  }

  function checkout(payload: Record<string, unknown>, opts: { ip?: string; forwardedFor?: string } = {}) {
    return app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload,
        remoteAddress: opts.ip ?? "127.0.0.1",
        ...(opts.forwardedFor ? { headers: { "x-forwarded-for": opts.forwardedFor } } : {}),
      }),
    );
  }

  // ---- 1E-1 -----------------------------------------------------------
  it("lets a normal COD order through, with server-computed totals", async () => {
    const { cartId } = await seedCart(2); // 2 x 100.00
    const response = await checkout({
      cartId,
      email: "buyer@example.com",
      phone: "+212600112233",
      shippingAddress: validAddress,
    });

    expect(response.statusCode).toBe(201);
    const { order } = response.json();
    expect(order.subtotalAmount).toEqual({ amount: "200.00", currencyCode: "MAD" });
    expect(order.shippingAmount).toEqual({ amount: "30.00", currencyCode: "MAD" });
    expect(order.totalAmount).toEqual({ amount: "230.00", currencyCode: "MAD" });
  });

  // ---- 1E-2 -----------------------------------------------------------
  it("eventually returns 429 for repeated order attempts from the same IP", async () => {
    // Distinct phone per request so the per-phone guard never fires first —
    // this isolates the per-IP limiter. Bogus cart ids: the requests fail
    // at 404 until the rate-limit hook (which runs first) starts replying 429.
    const results: number[] = [];
    let firstBlocked: Awaited<ReturnType<typeof checkout>> | undefined;
    for (let i = 0; i < 25; i++) {
      const r = await checkout({
        cartId: crypto.randomUUID(),
        email: `flood${i}@example.com`,
        phone: `+2126001${String(10000 + i).slice(-5)}`,
        shippingAddress: validAddress,
      });
      results.push(r.statusCode);
      if (r.statusCode === 429 && !firstBlocked) firstBlocked = r;
    }

    expect(results).toContain(429);
    // The limiter kicks in around COD_ORDER_IP_MAX (20), not on request 1.
    expect(results.slice(0, 10).every((code) => code !== 429)).toBe(true);

    // 1D — clean envelope, Retry-After, nothing internal leaked.
    expect(firstBlocked!.headers["retry-after"]).toBeDefined();
    expect(firstBlocked!.json()).toEqual({
      error: { code: "RATE_LIMITED", message: expect.any(String) },
    });
  });

  // ---- 1E-3 ----------------------------------------------------------
  it("cannot be bypassed by rotating a spoofed X-Forwarded-For from an untrusted client", async () => {
    const results: number[] = [];
    for (let i = 0; i < 25; i++) {
      const r = await checkout(
        {
          cartId: crypto.randomUUID(),
          email: `spoof${i}@example.com`,
          phone: `+2126002${String(10000 + i).slice(-5)}`,
          shippingAddress: validAddress,
        },
        // Direct (untrusted) client, different fake proxy header every time.
        { ip: "198.51.100.42", forwardedFor: `10.0.0.${i}` },
      );
      results.push(r.statusCode);
    }
    // All 25 share the real socket IP → the spoof buys nothing.
    expect(results).toContain(429);
  });

  // ---- 1E-4 ----------------------------------------------------------
  it("does not conflate different real clients arriving through the trusted proxy", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 25; i++) {
      const { cartId } = await seedCart(1);
      const r = await checkout(
        {
          cartId,
          email: `shopper${i}@example.com`,
          phone: `+2126003${String(10000 + i).slice(-5)}`,
          shippingAddress: validAddress,
        },
        // Co-located Nginx forwarding a distinct shopper IP each time.
        { ip: "127.0.0.1", forwardedFor: `41.92.${i}.5` },
      );
      codes.push(r.statusCode);
    }
    // Each distinct forwarded IP has exactly one hit → nobody is rate-limited.
    expect(codes.every((code) => code === 201)).toBe(true);
  });

  // ---- 1E-6 ----------------------------------------------------------
  it("blocks excessive orders from the same normalized phone within the window", async () => {
    // Different forwarded IPs so only the per-phone guard can fire. The phone
    // is written in a different format each time — all normalize to one key.
    const formats = [
      "+212611223344",
      "00212611223344",
      "0611223344",
      "+212 611 22 33 44",
      "0611-22-33-44",
      "+212611223344",
    ];
    const codes: number[] = [];
    for (let i = 0; i < formats.length; i++) {
      const { cartId } = await seedCart(1);
      const r = await checkout(
        { cartId, email: `repeat${i}@example.com`, phone: formats[i]!, shippingAddress: validAddress },
        { ip: "127.0.0.1", forwardedFor: `196.200.${i}.9` },
      );
      codes.push(r.statusCode);
    }

    // First COD_ORDER_PHONE_MAX (5) succeed, the 6th is refused.
    expect(codes.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(codes[5]).toBe(429);
  });

  // ---- 1D -----------------------------------------------------------
  it("returns a clean 429 envelope with Retry-After and no internal detail", async () => {
    let blocked: Awaited<ReturnType<typeof checkout>> | undefined;
    for (let i = 0; i < 8 && !blocked; i++) {
      const { cartId } = await seedCart(1);
      const r = await checkout(
        { cartId, email: `env${i}@example.com`, phone: "+212655667788", shippingAddress: validAddress },
        { ip: "127.0.0.1", forwardedFor: `102.50.${i}.1` },
      );
      if (r.statusCode === 429) blocked = r;
    }

    expect(blocked).toBeDefined();
    expect(blocked!.headers["retry-after"]).toBeDefined();
    const body = blocked!.json();
    expect(body).toEqual({
      error: { code: "TOO_MANY_ORDERS", message: expect.any(String) },
    });
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain("window");
    expect(raw).not.toContain("stack");
    expect(raw).not.toContain("postgres");
  });

  // ---- 1E-8 / 1E-9 : existing validation is untouched --------------
  it("still rejects client-submitted totals (price tampering)", async () => {
    const { cartId } = await seedCart(1);
    const response = await checkout({
      cartId,
      email: "buyer@example.com",
      phone: "+212600999888",
      shippingAddress: validAddress,
      totalAmount: "1.00",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("still computes subtotal/shipping/total server-side, ignoring the client", async () => {
    const { cartId } = await seedCart(3, { priceAmount: "149.99" });
    const response = await checkout({
      cartId,
      email: "buyer@example.com",
      phone: "+212600777666",
      shippingAddress: validAddress,
    });
    expect(response.statusCode).toBe(201);
    const { order } = response.json();
    expect(order.subtotalAmount).toEqual({ amount: "449.97", currencyCode: "MAD" });
    expect(order.totalAmount).toEqual({ amount: "479.97", currencyCode: "MAD" });
  });

  // ---- 1E-10 : stock / availability behavior is untouched ---------
  it("still rejects an order when stock ran out, and decrements stock on success", async () => {
    const shortfall = await seedCart(2, { stock: 2 });
    // Stock sells out from under the cart between add-to-cart and checkout.
    await db.update(productVariants).set({ stock: 1 }).where(eq(productVariants.id, shortfall.variant.id));
    const outOfStock = await checkout({
      cartId: shortfall.cartId,
      email: "buyer@example.com",
      phone: "+212600555444",
      shippingAddress: validAddress,
    });
    expect(outOfStock.statusCode).toBe(409);
    expect(outOfStock.json().error.code).toBe("OUT_OF_STOCK");
    expect((await db.select().from(orders)).length).toBe(0);

    const ok = await seedCart(3, { stock: 10 });
    const success = await checkout({
      cartId: ok.cartId,
      email: "buyer@example.com",
      phone: "+212600333222",
      shippingAddress: validAddress,
    });
    expect(success.statusCode).toBe(201);
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ok.variant.id));
    expect(variant?.stock).toBe(7);
  });
});
