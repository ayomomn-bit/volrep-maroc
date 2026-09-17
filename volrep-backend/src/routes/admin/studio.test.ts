import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin } from "../../test/admin.js";
import { seedProduct, seedImage, seedVariant } from "../../test/seed.js";
import { closeDb } from "../../db/client.js";

describe("Admin Product Studio API", () => {
  let app: FastifyInstance;
  let staff: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
    staff = (await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" })).sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  // ---- studio payload ----

  it("GET /studio returns product + landing pages + completeness (no hero, no content blocks)", async () => {
    const product = await seedProduct({ handle: "studio-a", status: "draft" });
    await seedVariant(product.id, { priceAmount: "899.00" });
    await seedImage(product.id, { storageKey: "products/abc.png", position: 0 });

    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/studio` }));
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.product.id).toBe(product.id);
    expect(body).not.toHaveProperty("hero");
    expect(body).not.toHaveProperty("contentBlocks");
    expect(body.landingPages).toEqual([]);

    // Completeness now only tracks media / commerce / landing pages.
    expect(Object.keys(body.completeness).sort()).toEqual(["commerce", "landingPages", "media"]);
    expect(body.completeness).not.toHaveProperty("hero");
    expect(body.completeness).not.toHaveProperty("seo");
    expect(body.completeness).not.toHaveProperty("content");
    expect(body.completeness.media).toMatchObject({ total: 1, owned: 1, ready: true });
    expect(body.completeness.commerce).toMatchObject({ variants: 1, priced: true, published: false });
    expect(body.completeness.landingPages).toMatchObject({ total: 0, linked: 0, verified: 0, needsAttention: false });
  });

  it("completeness.commerce.priced is false for a product with no variants", async () => {
    const product = await seedProduct({ handle: "studio-noprice" });
    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/studio` }));
    expect(res.json().completeness.commerce.priced).toBe(false);
  });

  it("GET /studio 404s for an unknown product", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/00000000-0000-0000-0000-000000000000/studio` }),
    );
    expect(res.statusCode).toBe(404);
  });

  it("requires an admin session", async () => {
    const product = await seedProduct({ handle: "studio-auth" });
    const res = await app.inject({ method: "GET", url: `/api/admin/products/${product.id}/studio` });
    expect(res.statusCode).toBe(401);
  });

  // ---- removed endpoints are gone ----

  it("the hero and content-block write endpoints no longer exist (404)", async () => {
    const product = await seedProduct({ handle: "studio-gone" });
    const hero = await app.inject(
      asAdmin(staff, { method: "PUT", url: `/api/admin/products/${product.id}/hero`, payload: { headline: "x" } }),
    );
    expect(hero.statusCode).toBe(404);

    const blocks = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/content-blocks` }),
    );
    expect(blocks.statusCode).toBe(404);

    const createBlock = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/content-blocks`,
        payload: { type: "benefits", data: { items: [] } },
      }),
    );
    expect(createBlock.statusCode).toBe(404);
  });

  // ---- landing pages ----
  // Full Lirya binding behaviour lives in landing-pages.test.ts (injected
  // fake client). Here we only assert the studio payload stays cache-only
  // and the endpoint is wired.

  it("GET /landing-pages is empty for a fresh product and reports Lirya as not configured", async () => {
    const product = await seedProduct({ handle: "studio-lp" });
    const res = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}/landing-pages` }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().landingPages).toEqual([]);
    expect(res.json().liryaConfigured).toBe(false);
  });

  // ---- existing detail contract still works ----

  it("GET /api/admin/products/:id still works; content is now just { subtitle }", async () => {
    const product = await seedProduct({ handle: "studio-compat" });
    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}` }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.product).not.toHaveProperty("hero");
    expect(body.product).not.toHaveProperty("contentBlocks");
    expect(Object.keys(body.product.content)).toEqual(["subtitle"]);
  });
});
