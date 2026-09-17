import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedAdmin } from "../test/admin.js";
import { closeDb } from "../db/client.js";

// Step 4 H1 — the GLOBAL @fastify/rate-limit limiter must not throttle
// trusted server-to-server storefront traffic (correct x-internal-api-key)
// as one shared bucket keyed on the single Next.js server IP, while:
//   • still capping unauthenticated / direct traffic at 100/min, and
//   • leaving the per-route limiters (login, COD, order tracking) fully
//     effective for the internal caller too (they override the allow-list
//     with `allowList: []`).
describe("global rate limiter — internal-key allow-list (Step 4 H1)", () => {
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

  it("does not 429 many rapid internal-key requests to /api/products (well past the global max of 100)", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 120; i++) {
      const res = await app.inject(withAuth({ method: "GET", url: "/api/products" }));
      codes.push(res.statusCode);
    }
    expect(codes.some((c) => c === 429)).toBe(false);
    expect(codes.every((c) => c === 200)).toBe(true);
  });

  it("still globally rate-limits requests WITHOUT the internal key", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 120; i++) {
      const res = await app.inject({ method: "GET", url: "/api/products" });
      codes.push(res.statusCode);
    }
    // The first ~100 are rejected by requireInternalApiKey (401); once the
    // global bucket is exhausted the limiter short-circuits with 429.
    expect(codes).toContain(401);
    expect(codes).toContain(429);
  });

  it("keeps the COD per-route limiter effective for internal-key callers (allowList: [] override)", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await app.inject(
        withAuth({
          method: "POST",
          url: "/api/checkout/session",
          payload: {
            cartId: crypto.randomUUID(), // no such cart → 404 until the limiter fires
            email: `h1-${i}@example.com`,
            phone: `+2126001${String(10000 + i).slice(-5)}`, // distinct → per-phone guard never first
            shippingAddress: { line1: "1 Rue Test", city: "Casablanca", country: "MA" },
          },
        }),
      );
      codes.push(res.statusCode);
    }
    // Requests carry the globally-allow-listed internal key, yet the COD
    // per-route guard (COD_ORDER_IP_MAX) still fires.
    expect(codes).toContain(429);
    expect(codes.slice(0, 10).every((c) => c !== 429)).toBe(true);
  });

  it("keeps the admin-login per-route limiter effective (10 / 15 min per IP)", async () => {
    await seedAdmin({ email: "owner@volrep.test" });
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        payload: { email: "owner@volrep.test", password: "definitely-the-wrong-password" },
      });
      codes.push(res.statusCode);
    }
    expect(codes.filter((c) => c === 401).length).toBeGreaterThanOrEqual(10);
    expect(codes).toContain(429);
  });
});
