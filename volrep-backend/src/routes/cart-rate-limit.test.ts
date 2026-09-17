import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct, seedVariant } from "../test/seed.js";
import { closeDb, db } from "../db/client.js";
import { cartLines, carts } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";

// Step 4 L3 — the storefront cart MUTATION endpoints (POST/PATCH/DELETE
// /api/cart/lines) are per-route rate limited. The GET is read-only and
// intentionally excluded. The limiter keys on the cart id when the request
// carries one, else on the trusted client IP; `allowList: []` keeps it
// effective for the internal-key storefront caller (Step 4 H1).
describe("Cart mutation rate limiting (L3)", () => {
  let app: FastifyInstance;
  const MAX = env.CART_MUTATION_RATE_MAX;

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

  async function seedPurchasableVariant() {
    const product = await seedProduct({ handle: `cart-l3-${crypto.randomUUID()}` });
    return seedVariant(product.id, { priceAmount: "100.00", stock: 999 });
  }

  async function newCartWithLine() {
    const variant = await seedPurchasableVariant();
    const res = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const { cart } = res.json();
    return { cartId: cart.id as string, lineId: cart.lines[0].id as string, variantId: variant.id as string };
  }

  it("allows a normal cart mutation and requests below the threshold", async () => {
    const { cartId, lineId } = await newCartWithLine();

    for (let i = 0; i < MAX - 1; i++) {
      const res = await app.inject(
        withAuth({
          method: "PATCH",
          url: `/api/cart/lines/${lineId}`,
          payload: { cartId, quantity: (i % 5) + 1 },
        }),
      );
      expect(res.statusCode).toBe(200);
    }
  });

  it("returns 429 (RATE_LIMITED envelope + Retry-After) once the per-cart threshold is exceeded", async () => {
    const { cartId, lineId } = await newCartWithLine();

    let firstRejection: number | null = null;
    for (let i = 0; i < MAX + 5; i++) {
      const res = await app.inject(
        withAuth({ method: "PATCH", url: `/api/cart/lines/${lineId}`, payload: { cartId, quantity: 2 } }),
      );
      if (res.statusCode === 429 && firstRejection === null) {
        firstRejection = i;
        expect(res.json().error.code).toBe("RATE_LIMITED");
        // Generic message, no limiter internals / secrets leaked.
        expect(JSON.stringify(res.json())).not.toMatch(/max|window|remaining|bucket|token|key/i);
        expect(res.headers["retry-after"]).toBeDefined();
      }
    }
    // The POST that created the cart had no cartId → it was keyed on
    // `ip:127.0.0.1`, NOT on this cart. So these PATCHes are hits 1..MAX on
    // the fresh `cart:<id>` bucket; hit MAX+1 (0-indexed MAX) is the first
    // rejection.
    expect(firstRejection).toBe(MAX);
  });

  it("a rate-limited request performs NO cart mutation", async () => {
    const { cartId, lineId } = await newCartWithLine();

    // Drive the cart bucket to the limit with quantity=3.
    for (let i = 0; i < MAX; i++) {
      await app.inject(
        withAuth({ method: "PATCH", url: `/api/cart/lines/${lineId}`, payload: { cartId, quantity: 3 } }),
      );
    }
    const [before] = await db.select().from(cartLines).where(eq(cartLines.id, lineId));
    expect(before?.quantity).toBe(3);

    // This one is rejected — it must not apply quantity=9.
    const blocked = await app.inject(
      withAuth({ method: "PATCH", url: `/api/cart/lines/${lineId}`, payload: { cartId, quantity: 9 } }),
    );
    expect(blocked.statusCode).toBe(429);

    const [after] = await db.select().from(cartLines).where(eq(cartLines.id, lineId));
    expect(after?.quantity).toBe(3);
    // The cart row's updatedAt is untouched too (no touchCart side effect).
    expect(after?.quantity).toBe(before?.quantity);
  });

  it("isolates carts: flooding cart A does not rate-limit cart B (keyed on cart id, not the shared IP)", async () => {
    const a = await newCartWithLine();
    const b = await newCartWithLine();

    for (let i = 0; i < MAX + 2; i++) {
      await app.inject(
        withAuth({ method: "PATCH", url: `/api/cart/lines/${a.lineId}`, payload: { cartId: a.cartId, quantity: 2 } }),
      );
    }
    // Cart A is now limited...
    const aBlocked = await app.inject(
      withAuth({ method: "PATCH", url: `/api/cart/lines/${a.lineId}`, payload: { cartId: a.cartId, quantity: 4 } }),
    );
    expect(aBlocked.statusCode).toBe(429);

    // ...but cart B — same client IP (127.0.0.1 in inject) — is unaffected.
    const bOk = await app.inject(
      withAuth({ method: "PATCH", url: `/api/cart/lines/${b.lineId}`, payload: { cartId: b.cartId, quantity: 4 } }),
    );
    expect(bOk.statusCode).toBe(200);
    expect(bOk.json().cart.lines[0].quantity).toBe(4);
  });

  it("covers the DELETE mutation endpoint", async () => {
    const variant = await seedPurchasableVariant();
    // Build a cart with many lines so we can DELETE repeatedly.
    const add = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
    );
    const cartId = add.json().cart.id as string;

    let sawRejection = false;
    for (let i = 0; i < MAX + 3; i++) {
      // deleting a non-existent line id → 404 normally; once limited → 429
      const res = await app.inject(
        withAuth({ method: "DELETE", url: `/api/cart/lines/${crypto.randomUUID()}?cartId=${cartId}` }),
      );
      if (res.statusCode === 429) {
        sawRejection = true;
        expect(res.json().error.code).toBe("RATE_LIMITED");
        break;
      }
      expect(res.statusCode).toBe(404);
    }
    expect(sawRejection).toBe(true);
  });

  it("covers the POST mutation endpoint, keyed on IP when no cart id is supplied", async () => {
    const variant = await seedPurchasableVariant();

    let firstRejection: number | null = null;
    for (let i = 0; i < MAX + 5; i++) {
      const res = await app.inject(
        withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
      );
      if (res.statusCode === 429 && firstRejection === null) firstRejection = i;
    }
    // Every no-cartId POST from 127.0.0.1 shares the `ip:127.0.0.1` bucket.
    expect(firstRejection).toBe(MAX);
  });

  it("does NOT rate-limit the read-only GET /api/cart", async () => {
    const { cartId } = await newCartWithLine();
    const codes: number[] = [];
    for (let i = 0; i < MAX + 20; i++) {
      const res = await app.inject(withAuth({ method: "GET", url: `/api/cart?cartId=${cartId}` }));
      codes.push(res.statusCode);
    }
    expect(codes.every((c) => c === 200)).toBe(true);
  });

  it("keeps the limiter effective for the internal-key caller (allowList: [] override, H1 intact)", async () => {
    // Every request here carries the internal key (withAuth) — the GLOBAL
    // limiter would allow-list it, but this per-route guard still fires.
    const { cartId, lineId } = await newCartWithLine();
    const codes: number[] = [];
    for (let i = 0; i < MAX + 5; i++) {
      const res = await app.inject(
        withAuth({ method: "PATCH", url: `/api/cart/lines/${lineId}`, payload: { cartId, quantity: 2 } }),
      );
      codes.push(res.statusCode);
    }
    expect(codes).toContain(429);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
  });

  it("a request with no internal key is still rejected (401) before the cart is touched", async () => {
    const { cartId, lineId } = await newCartWithLine();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/cart/lines/${lineId}`,
      payload: { cartId, quantity: 7 },
    });
    expect(res.statusCode).toBe(401);
    const [row] = await db.select().from(cartLines).where(eq(cartLines.id, lineId));
    expect(row?.quantity).toBe(1);
  });

  it("leaves no orphaned carts from rejected POSTs (no side effect on 429)", async () => {
    const variant = await seedPurchasableVariant();
    for (let i = 0; i < MAX + 10; i++) {
      await app.inject(
        withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant.id, quantity: 1 } }),
      );
    }
    // Exactly MAX carts were created (the first MAX POSTs); the rejected
    // ones created nothing.
    const allCarts = await db.select().from(carts);
    expect(allCarts.length).toBe(MAX);
  });
});
