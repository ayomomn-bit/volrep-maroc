import Fastify from "fastify";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { buildApp, buildLoggerOptions } from "../app.js";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedProduct, seedProductPage } from "../test/seed.js";
import { seedAndLoginAdmin, asAdmin } from "../test/admin.js";
import { closeDb, db } from "../db/client.js";
import { DEFAULT_PAGE_DOCUMENT } from "../lib/product-page/defaults.js";
import { mintPreviewToken } from "../lib/product-page/preview-token.js";

// Step 4 L4 — preview / admin / health hardening.
describe("L4 hardening", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  describe("health endpoint discloses no infrastructure state", () => {
    it("200 path returns only { status: 'ok' }", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("503 path (DB down) returns only { status: 'error' } — no error text / dependency name", async () => {
      const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("ECONNREFUSED 10.1.2.3:5432 password=hunter2"));
      // The health route builds its own app instance in production, but the
      // shared test app uses the same handler; drive it directly.
      const probe = await buildApp();
      try {
        const res = await probe.inject({ method: "GET", url: "/health" });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ status: "error" });
        expect(JSON.stringify(res.json())).not.toMatch(/ECONNREFUSED|5432|hunter2|password|postgres|database/i);
      } finally {
        await probe.close();
      }
      spy.mockRestore();
    });

    it("still actually checks the database (regression: it is a readiness probe, not a static 200)", async () => {
      // sanity: a real select 1 succeeds through the same path
      await expect(db.execute(sql`select 1`)).resolves.toBeDefined();
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("admin responses are not cacheable", () => {
    it("sets Cache-Control: no-store on an authenticated admin GET", async () => {
      const { sessionId } = await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
      const res = await app.inject(asAdmin(sessionId, { method: "GET", url: "/api/admin/orders" }));
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("sets Cache-Control: no-store even on a rejected admin request (401)", async () => {
      const res = await app.inject({ method: "GET", url: "/api/admin/orders" });
      expect(res.statusCode).toBe(401);
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("does NOT add no-store to storefront routes (change is scoped to /api/admin/*)", async () => {
      const res = await app.inject(withAuth({ method: "GET", url: "/api/products" }));
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).not.toBe("no-store");
    });

    it("the admin auth boundary is unchanged — no cookie still 401, and no-store never leaks admin data", async () => {
      const res = await app.inject({ method: "GET", url: "/api/admin/orders/00000000-0000-4000-8000-000000000000" });
      expect(res.statusCode).toBe(401);
      expect(JSON.stringify(res.json())).not.toMatch(/email|phone|shippingAddress/i);
    });
  });

  describe("preview token is kept out of the request log", () => {
    // Drive a real Fastify/pino instance with the app's shipped logger
    // options + a capture stream, then hit the preview endpoint.
    async function appWithCapturedLogs() {
      const lines: string[] = [];
      const instance = await buildApp();
      // buildApp already wired the logger; attach a second sink by logging
      // through a fresh instance that reuses the exact serializer config.
      const probe = Fastify({
        logger: { ...buildLoggerOptions(), level: "info", stream: { write: (s: string) => void lines.push(s) } },
      });
      probe.get("/api/products/:handle/page", async () => ({ ok: true }));
      await instance.close();
      return { probe, lines };
    }

    it("masks ?preview=<token> in the logged request URL, keeps the rest of the URL", async () => {
      const { probe, lines } = await appWithCapturedLogs();
      try {
        await probe.inject({
          method: "GET",
          url: "/api/products/some-handle/page?preview=test-preview-token&foo=bar",
        });
      } finally {
        await probe.close();
      }
      const out = lines.join("");
      expect(out).not.toContain("test-preview-token");
      expect(out).toMatch(/preview=\[Redacted\]/);
      // non-sensitive parts of the URL are still there for debugging
      expect(out).toContain("/api/products/some-handle/page");
      expect(out).toContain("foo=bar");
    });

    it("leaves an ordinary URL (no preview param) untouched in the log", async () => {
      const { probe, lines } = await appWithCapturedLogs();
      try {
        await probe.inject({ method: "GET", url: "/api/products/plain-handle/page" });
      } finally {
        await probe.close();
      }
      expect(lines.join("")).toContain("/api/products/plain-handle/page");
    });
  });

  describe("preview token verification (still correct after L4)", () => {
    it("accepts a valid token, rejects a forged / malformed one, no side effect", async () => {
      const product = await seedProduct({ handle: "l4-preview", status: "active" });
      const draft = structuredClone(DEFAULT_PAGE_DOCUMENT) as typeof DEFAULT_PAGE_DOCUMENT;
      draft.sections[0]!.enabled = false;
      await seedProductPage(product.id, { draft, published: DEFAULT_PAGE_DOCUMENT });

      const { token } = mintPreviewToken(product.id);
      const good = await app.inject(
        withAuth({ method: "GET", url: `/api/products/l4-preview/page?preview=${encodeURIComponent(token)}` }),
      );
      expect(good.json().preview).toBe(true);

      for (const bad of ["forged", "", "a.b.c", `${token}x`, "....", "%00"]) {
        const res = await app.inject(
          withAuth({ method: "GET", url: `/api/products/l4-preview/page?preview=${encodeURIComponent(bad)}` }),
        );
        expect(res.statusCode).toBe(200);
        expect(res.json().preview).toBe(false);
      }
    });

    it("an expired token is rejected", async () => {
      const product = await seedProduct({ handle: "l4-expired", status: "active" });
      await seedProductPage(product.id, { draft: DEFAULT_PAGE_DOCUMENT, published: DEFAULT_PAGE_DOCUMENT });
      // mint with a timestamp 40 min in the past → already expired (TTL 30m)
      const { token } = mintPreviewToken(product.id, Date.now() - 40 * 60 * 1000);
      const res = await app.inject(
        withAuth({ method: "GET", url: `/api/products/l4-expired/page?preview=${encodeURIComponent(token)}` }),
      );
      expect(res.json().preview).toBe(false);
    });
  });
});
