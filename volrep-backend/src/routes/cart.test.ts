import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct, seedVariant } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { carts } from "../db/schema/index.js";

describe("Cart API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeDb();
  });

  async function seedPurchasableVariant(overrides: Parameters<typeof seedVariant>[1] = {}) {
    const product = await seedProduct();
    return seedVariant(product.id, { priceAmount: "100.00", stock: 5, ...overrides });
  }

  it("returns null for a nonexistent cart", async () => {
    const response = await app.inject(
      withAuth({ method: "GET", url: `/api/cart?cartId=${crypto.randomUUID()}` }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ cart: null });
  });

  it("returns null when cartId is omitted", async () => {
    const response = await app.inject(withAuth({ method: "GET", url: "/api/cart" }));
    expect(response.json()).toEqual({ cart: null });
  });

  it("creates a cart on first add and returns it on GET", async () => {
    const variant = await seedPurchasableVariant();

    const addResponse = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 2 } }),
    );
    expect(addResponse.statusCode).toBe(200);
    const { cart } = addResponse.json();
    expect(cart.totalQuantity).toBe(2);
    expect(cart.lines).toHaveLength(1);
    expect(cart.cost.subtotalAmount).toEqual({ amount: "200.00", currencyCode: "MAD" });

    const getResponse = await app.inject(withAuth({ method: "GET", url: `/api/cart?cartId=${cart.id}` }));
    expect(getResponse.json().cart.id).toBe(cart.id);
  });

  it("computes totals from the database price, never from client input (price tampering)", async () => {
    const variant = await seedPurchasableVariant({ priceAmount: "250.00" });

    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/cart/lines",
        // Deliberately sending fields the schema forbids.
        payload: { variantId: variant.id, quantity: 1, price: "1.00", subtotal: "1.00" },
      }),
    );

    // .strict() rejects the unknown fields outright rather than silently
    // ignoring them — this IS the tamper defense.
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("merges a second add-to-cart for the same variant into one line", async () => {
    const variant = await seedPurchasableVariant();

    const first = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const cartId = first.json().cart.id;

    const second = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/cart/lines",
        payload: { cartId, variantId: variant.id, quantity: 2 },
      }),
    );

    const { cart } = second.json();
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(3);
    expect(cart.totalQuantity).toBe(3);
  });

  it("rejects an unknown variant id", async () => {
    const response = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/cart/lines",
        payload: { variantId: crypto.randomUUID(), quantity: 1 },
      }),
    );
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("rejects an invalid quantity", async () => {
    const variant = await seedPurchasableVariant();
    const response = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 0 } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rejects adding more than the available stock", async () => {
    const variant = await seedPurchasableVariant({ stock: 2 });
    const response = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 3 } }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("OUT_OF_STOCK");
  });

  it("rejects a variant the admin has disabled even if stock exists", async () => {
    const variant = await seedPurchasableVariant({ availableForSale: false, stock: 10 });
    const response = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("updates a line's quantity", async () => {
    const variant = await seedPurchasableVariant({ stock: 10 });
    const added = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const { cart } = added.json();
    const lineId = cart.lines[0].id;

    const updated = await app.inject(
      withAuth({
        method: "PATCH",
        url: `/api/cart/lines/${lineId}`,
        payload: { cartId: cart.id, quantity: 4 },
      }),
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json().cart.lines[0].quantity).toBe(4);
  });

  it("treats a PATCH to quantity 0 as a removal", async () => {
    const variant = await seedPurchasableVariant();
    const added = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const { cart } = added.json();
    const lineId = cart.lines[0].id;

    const updated = await app.inject(
      withAuth({ method: "PATCH", url: `/api/cart/lines/${lineId}`, payload: { cartId: cart.id, quantity: 0 } }),
    );
    expect(updated.json().cart.lines).toHaveLength(0);
  });

  it("removes a line", async () => {
    const variant = await seedPurchasableVariant();
    const added = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const { cart } = added.json();
    const lineId = cart.lines[0].id;

    const removed = await app.inject(
      withAuth({ method: "DELETE", url: `/api/cart/lines/${lineId}?cartId=${cart.id}` }),
    );
    expect(removed.statusCode).toBe(200);
    expect(removed.json().cart.lines).toHaveLength(0);
    expect(removed.json().cart.totalQuantity).toBe(0);
  });

  it("rejects mutating a line that belongs to a different cart (ownership check)", async () => {
    const variant = await seedPurchasableVariant({ stock: 10 });
    const cartAResponse = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const lineId = cartAResponse.json().cart.lines[0].id;

    // A second, unrelated cart.
    const [cartB] = await db.insert(carts).values({ expiresAt: new Date(Date.now() + 86_400_000) }).returning();

    const response = await app.inject(
      withAuth({
        method: "PATCH",
        url: `/api/cart/lines/${lineId}`,
        payload: { cartId: cartB!.id, quantity: 2 },
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it("returns 404 for a line id that doesn't exist", async () => {
    const [cart] = await db.insert(carts).values({ expiresAt: new Date(Date.now() + 86_400_000) }).returning();
    const response = await app.inject(
      withAuth({
        method: "PATCH",
        url: `/api/cart/lines/${crypto.randomUUID()}`,
        payload: { cartId: cart!.id, quantity: 1 },
      }),
    );
    expect(response.statusCode).toBe(404);
  });
});
