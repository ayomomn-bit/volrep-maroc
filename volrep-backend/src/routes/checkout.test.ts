import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct, seedShipping, seedVariant } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { carts, orderLineItems, orders, productVariants } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

describe("COD Checkout API", () => {
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

  async function seedCartWithLine(quantity = 1, variantOverrides: Parameters<typeof seedVariant>[1] = {}) {
    const product = await seedProduct({ handle: `volrep-prm-${crypto.randomUUID()}` });
    const variant = await seedVariant(product.id, { priceAmount: "100.00", stock: 10, ...variantOverrides });
    const addResponse = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity } }),
    );
    return { cartId: addResponse.json().cart.id as string, variant };
  }

  it("creates a COD order with server-computed totals", async () => {
    const { cartId } = await seedCartWithLine(2); // 2 x 100.00

    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId, email: "buyer@example.com", phone: "+212600000000", shippingAddress: validAddress },
      }),
    );

    expect(response.statusCode).toBe(201);
    const { order } = response.json();
    expect(order.status).toBe("pending_payment");
    expect(order.subtotalAmount).toEqual({ amount: "200.00", currencyCode: "MAD" });
    expect(order.shippingAmount).toEqual({ amount: "30.00", currencyCode: "MAD" });
    expect(order.totalAmount).toEqual({ amount: "230.00", currencyCode: "MAD" });
    expect(order.paymentProvider).toBe("cod");
    expect(order.orderNumber).toMatch(/^#\d+$/);
    // No redirectUrl at all — COD has nothing to redirect to.
    expect(response.json().redirectUrl).toBeUndefined();
  });

  it("ignores/rejects client-submitted totals (price tampering)", async () => {
    const { cartId } = await seedCartWithLine(1);

    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: {
          cartId,
          email: "buyer@example.com",
          phone: "+212600000000",
          shippingAddress: validAddress,
          totalAmount: "1.00",
        },
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("requires an email", async () => {
    const { cartId } = await seedCartWithLine(1);
    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId, phone: "+212600000000", shippingAddress: validAddress },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("requires a phone number", async () => {
    const { cartId } = await seedCartWithLine(1);
    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId, email: "buyer@example.com", shippingAddress: validAddress },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rejects an incomplete/invalid shipping address", async () => {
    const { cartId } = await seedCartWithLine(1);
    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: {
          cartId,
          email: "buyer@example.com",
          phone: "+212600000000",
          shippingAddress: { line1: "1 Test St" }, // missing city + country
        },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rejects checkout for an empty cart", async () => {
    const [cart] = await db.insert(carts).values({ expiresAt: new Date(Date.now() + 86_400_000) }).returning();

    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: {
          cartId: cart!.id,
          email: "buyer@example.com",
          phone: "+212600000000",
          shippingAddress: validAddress,
        },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rejects checkout when a line's stock is no longer sufficient", async () => {
    const { cartId, variant } = await seedCartWithLine(2, { stock: 2 });
    // Stock sold out from under the cart between add-to-cart and checkout.
    await db.update(productVariants).set({ stock: 1 }).where(eq(productVariants.id, variant.id));

    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId, email: "buyer@example.com", phone: "+212600000000", shippingAddress: validAddress },
      }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("OUT_OF_STOCK");

    // Nothing should have been decremented or created.
    const [freshVariant] = await db.select().from(productVariants).where(eq(productVariants.id, variant.id));
    expect(freshVariant?.stock).toBe(1);
    const allOrders = await db.select().from(orders);
    expect(allOrders).toHaveLength(0);
  });

  it("prevents duplicate order creation from a resubmitted checkout", async () => {
    const { cartId } = await seedCartWithLine(1);
    const body = { cartId, email: "buyer@example.com", phone: "+212600000000", shippingAddress: validAddress };

    const first = await app.inject(withAuth({ method: "POST", url: "/api/checkout/session", payload: body }));
    expect(first.statusCode).toBe(201);

    const second = await app.inject(withAuth({ method: "POST", url: "/api/checkout/session", payload: body }));
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("CART_NOT_ACTIVE");

    const allOrders = await db.select().from(orders);
    expect(allOrders).toHaveLength(1);
  });

  it("assigns increasing order numbers across separate orders", async () => {
    const first = await seedCartWithLine(1);
    const firstResponse = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId: first.cartId, email: "a@example.com", phone: "+212600000001", shippingAddress: validAddress },
      }),
    );

    const second = await seedCartWithLine(1);
    const secondResponse = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId: second.cartId, email: "b@example.com", phone: "+212600000002", shippingAddress: validAddress },
      }),
    );

    expect(firstResponse.json().order.orderNumber).toBe("#1001");
    expect(secondResponse.json().order.orderNumber).toBe("#1002");
  });

  it("marks the cart converted, snapshots line items, and decrements stock after a successful order", async () => {
    const { cartId, variant } = await seedCartWithLine(3, { stock: 10 });

    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: { cartId, email: "buyer@example.com", phone: "+212600000000", shippingAddress: validAddress },
      }),
    );
    const orderId = response.json().order.id as string;

    const [cart] = await db.select().from(carts).where(eq(carts.id, cartId));
    expect(cart?.status).toBe("converted");

    const [freshVariant] = await db.select().from(productVariants).where(eq(productVariants.id, variant.id));
    expect(freshVariant?.stock).toBe(7);

    const items = await db.select().from(orderLineItems).where(eq(orderLineItems.orderId, orderId));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 3, unitPriceAmount: "100.00" });

    // A cart already converted can't be read back via GET /api/cart either.
    const cartResponse = await app.inject(withAuth({ method: "GET", url: `/api/cart?cartId=${cartId}` }));
    expect(cartResponse.json()).toEqual({ cart: null });
  });

  it("rejects checkout to a country with no shipping configuration", async () => {
    const { cartId } = await seedCartWithLine(1);
    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: {
          cartId,
          email: "buyer@example.com",
          phone: "+212600000000",
          shippingAddress: { ...validAddress, country: "ZZ" },
        },
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("SHIPPING_UNAVAILABLE");
  });
});
