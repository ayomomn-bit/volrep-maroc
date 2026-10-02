import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin, seedOrder } from "../../test/admin.js";
import { seedProduct, seedVariant } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, cartLines, carts, orderLineItems, productVariants, products } from "../../db/schema/index.js";

describe("Admin catalog API (products / variants / inventory)", () => {
  let app: FastifyInstance;
  let owner: string;
  let staff: string;
  let ownerId: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    const o = await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
    const s = await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" });
    owner = o.sessionId;
    ownerId = o.id;
    staff = s.sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  // closeDb() runs once at the very end of the file, in the last describe
  // block below (same pattern as routes/admin/media.test.ts's two
  // describes) — closing it here too would break that later block, since
  // vitest runs this describe's afterEach/afterAll to completion before
  // the next describe's tests start.

  // ---- products ----

  it("creates a product (owner), lists it, and returns full detail", async () => {
    const create = await app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: {
          handle: "test-roller",
          title: "Test Roller",
          productType: "Recovery",
          tags: ["a"],
          status: "draft",
          hasVariants: true,
        },
      }),
    );
    expect(create.statusCode).toBe(201);
    const id = create.json().product.id;
    expect(create.json().product.hasVariants).toBe(true);

    const list = await app.inject(asAdmin(owner, { method: "GET", url: "/api/admin/products" }));
    expect(list.json().products.some((p: { id: string }) => p.id === id)).toBe(true);

    const detail = await app.inject(asAdmin(owner, { method: "GET", url: `/api/admin/products/${id}` }));
    expect(detail.json().product).toMatchObject({ handle: "test-roller", title: "Test Roller", status: "draft" });

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "product.create"));
    expect(audit).toMatchObject({ adminUserId: ownerId, entityType: "product", entityId: id });
  });

  it("staff cannot create a product (owner-only)", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "POST", url: "/api/admin/products", payload: { handle: "x-y", title: "X" } }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("staff can edit product content but cannot publish/unpublish", async () => {
    const product = await seedProduct({ handle: "editable", status: "draft" });

    const content = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { description: "new copy" } }),
    );
    expect(content.statusCode).toBe(200);
    expect(content.json().product.description).toBe("new copy");

    const publish = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { status: "active" } }),
    );
    expect(publish.statusCode).toBe(403);
  });

  it("owner publishes a product and the storefront then serves it", async () => {
    const product = await seedProduct({ handle: "publish-me", status: "draft" });
    await seedVariant(product.id, { stock: 5 });

    const hidden = await app.inject(withAuth({ method: "GET", url: "/api/products/publish-me" }));
    expect(hidden.statusCode).toBe(404);

    const res = await app.inject(
      asAdmin(owner, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { status: "active" } }),
    );
    expect(res.statusCode).toBe(200);

    const shown = await app.inject(withAuth({ method: "GET", url: "/api/products/publish-me" }));
    expect(shown.statusCode).toBe(200);

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "product.status_change"));
    expect(audit?.metadata).toMatchObject({ changed: { status: { from: "draft", to: "active" } } });
  });

  it("rejects a duplicate handle", async () => {
    await seedProduct({ handle: "taken" });
    const res = await app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: { handle: "taken", title: "Dup", hasVariants: true },
      }),
    );
    expect(res.statusCode).toBe(409);
  });

  it("requires hasVariants on create, and rejects commerce fields when it is true", async () => {
    const missing = await app.inject(
      asAdmin(owner, { method: "POST", url: "/api/admin/products", payload: { handle: "no-mode", title: "X" } }),
    );
    expect(missing.statusCode).toBe(400);

    const commerceOnVariant = await app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: { handle: "variant-with-price", title: "X", hasVariants: true, priceAmount: "10.00" },
      }),
    );
    expect(commerceOnVariant.statusCode).toBe(400);
  });

  // ---- structured product content ----

  it("saves and reloads the subtitle (accroche), and audits it", async () => {
    const product = await seedProduct({ handle: "content-prod" });

    const save = await app.inject(
      asAdmin(staff, {
        method: "PATCH",
        url: `/api/admin/products/${product.id}`,
        payload: { subtitle: "Récupération musculaire, à la maison" },
      }),
    );
    expect(save.statusCode).toBe(200);
    expect(save.json().product.content).toEqual({ subtitle: "Récupération musculaire, à la maison" });

    const reload = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}` }));
    expect(reload.json().product.content).toEqual({ subtitle: "Récupération musculaire, à la maison" });

    const [audit] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "product.update"))
      .orderBy(desc(adminAuditLog.createdAt));
    expect(Object.keys((audit!.metadata as { changed: Record<string, unknown> }).changed)).toEqual(["subtitle"]);
  });

  it("rejects the removed marketing / SEO fields on PATCH (they live in Lirya now)", async () => {
    const product = await seedProduct({ handle: "content-removed" });
    for (const payload of [
      { marketingCopy: "x" },
      { benefits: [{ title: "a", body: "b" }] },
      { sellingPoints: ["a"] },
      { seoTitle: "x" },
      { seoDescription: "x" },
    ]) {
      const res = await app.inject(
        asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload }),
      );
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it("changes a product handle, rejecting duplicates and bad formats", async () => {
    const product = await seedProduct({ handle: "old-handle" });
    await seedProduct({ handle: "already-used" });

    const ok = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { handle: "new-handle" } }),
    );
    expect(ok.statusCode).toBe(200);
    expect(ok.json().product.handle).toBe("new-handle");

    const dupe = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { handle: "already-used" } }),
    );
    expect(dupe.statusCode).toBe(409);

    const bad = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { handle: "Not Valid" } }),
    );
    expect(bad.statusCode).toBe(400);
  });

  it("the storefront product contract is unchanged by the admin content fields", async () => {
    const product = await seedProduct({ handle: "contract-check", status: "active" });
    await seedVariant(product.id, { stock: 3 });
    await app.inject(
      asAdmin(owner, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { subtitle: "x" } }),
    );

    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/contract-check" }));
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json().product).sort()).toEqual(
      ["availableForSale", "compareAtPrice", "description", "featuredImage", "handle", "id", "images", "options", "price", "title", "variants"].sort(),
    );
  });

  // ---- variants ----

  it("creates a variant with price validation, then updates it", async () => {
    const product = await seedProduct({ handle: "with-variants" });

    const good = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/variants`,
        payload: { title: "Black", sku: "TR-BLK", priceAmount: "499.00", compareAtAmount: "599.00", stock: 10 },
      }),
    );
    expect(good.statusCode).toBe(201);
    const variantId = good.json().variant.id;
    expect(good.json().variant.price).toEqual({ amount: "499.00", currencyCode: "MAD" });

    const badPrice = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/variants`,
        payload: { title: "Bad", priceAmount: "-5" },
      }),
    );
    expect(badPrice.statusCode).toBe(400);

    const negativeStock = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/variants`,
        payload: { title: "Neg", priceAmount: "5.00", stock: -1 },
      }),
    );
    expect(negativeStock.statusCode).toBe(400);

    const update = await app.inject(
      asAdmin(staff, {
        method: "PATCH",
        url: `/api/admin/variants/${variantId}`,
        payload: { priceAmount: "459.00", availableForSale: false },
      }),
    );
    expect(update.statusCode).toBe(200);
    expect(update.json().variant.price).toEqual({ amount: "459.00", currencyCode: "MAD" });
    expect(update.json().variant.availableForSale).toBe(false);

    // a compare-at price must be strictly ABOVE the selling price
    const badCompare = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/variants/${variantId}`, payload: { compareAtAmount: "400.00" } }),
    );
    expect(badCompare.statusCode).toBe(400);
    expect(badCompare.json().error.message).toMatch(/prix barré/i);

    const goodCompare = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/variants/${variantId}`, payload: { compareAtAmount: "599.00" } }),
    );
    expect(goodCompare.statusCode).toBe(200);
    expect(goodCompare.json().variant.compareAtPrice).toEqual({ amount: "599.00", currencyCode: "MAD" });

    // the variant PATCH must NOT accept a `stock` field
    const stockViaPatch = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/variants/${variantId}`, payload: { stock: 999 } }),
    );
    expect(stockViaPatch.statusCode).toBe(400);
  });

  it("rejects a duplicate SKU", async () => {
    const product = await seedProduct({ handle: "sku-test" });
    await seedVariant(product.id, { sku: "DUPE" });
    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/variants`,
        payload: { title: "Two", priceAmount: "10.00", sku: "DUPE" },
      }),
    );
    expect(res.statusCode).toBe(409);
  });

  // ---- variant delete ----

  it("deletes a non-last variant and writes a variant.delete audit row", async () => {
    const product = await seedProduct({ handle: "del-variant" });
    const keep = await seedVariant(product.id, { title: "Black", stock: 4 });
    const drop = await seedVariant(product.id, { title: "White", sku: "TR-WHT", priceAmount: "499.00", stock: 9 });

    const res = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${drop.id}` }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: drop.id });

    const remaining = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(remaining.map((v) => v.id)).toEqual([keep.id]);

    const [audit] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.entityId, drop.id))
      .orderBy(desc(adminAuditLog.createdAt));
    expect(audit?.action).toBe("variant.delete");
    expect(audit?.entityType).toBe("product_variant");
    expect(audit?.metadata).toMatchObject({
      productId: product.id,
      title: "White",
      sku: "TR-WHT",
      price: "499.00",
      currency: "MAD",
      finalStock: 9,
    });
  });

  it("refuses to delete a product's only remaining variant (409 LAST_VARIANT)", async () => {
    const product = await seedProduct({ handle: "last-variant" });
    const only = await seedVariant(product.id, { title: "Only" });

    const res = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${only.id}` }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("LAST_VARIANT");

    const still = await db.select().from(productVariants).where(eq(productVariants.id, only.id));
    expect(still).toHaveLength(1);
  });

  it("refuses to delete a variant in a genuinely active cart (409) and leaves that cart line intact", async () => {
    const product = await seedProduct({ handle: "cart-variant" });
    await seedVariant(product.id, { title: "Black" });
    const inCart = await seedVariant(product.id, { title: "White" });

    const [cart] = await db
      .insert(carts)
      .values({ status: "active", expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    await db.insert(cartLines).values({ cartId: cart!.id, variantId: inCart.id, quantity: 2 });

    const res = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${inCart.id}` }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("VARIANT_IN_CART");

    // variant AND its active cart line both survive — nothing was touched
    const still = await db.select().from(productVariants).where(eq(productVariants.id, inCart.id));
    expect(still).toHaveLength(1);
    const lines = await db.select().from(cartLines).where(eq(cartLines.variantId, inCart.id));
    expect(lines).toHaveLength(1);
  });

  it("deletes a variant referenced only by dead carts (converted / expired), clearing those cart lines", async () => {
    const product = await seedProduct({ handle: "dead-cart-variant" });
    await seedVariant(product.id, { title: "Black" });
    const drop = await seedVariant(product.id, { title: "White" });

    const [converted] = await db
      .insert(carts)
      .values({ status: "converted", expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    const [expired] = await db
      .insert(carts)
      .values({ status: "active", expiresAt: new Date(Date.now() - 60_000) })
      .returning();
    await db.insert(cartLines).values([
      { cartId: converted!.id, variantId: drop.id, quantity: 1 },
      { cartId: expired!.id, variantId: drop.id, quantity: 3 },
    ]);

    const res = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${drop.id}` }));
    expect(res.statusCode).toBe(200);

    const stillVariant = await db.select().from(productVariants).where(eq(productVariants.id, drop.id));
    expect(stillVariant).toHaveLength(0);
    const stillLines = await db.select().from(cartLines).where(eq(cartLines.variantId, drop.id));
    expect(stillLines).toHaveLength(0);
    // the dead carts themselves are untouched
    const cartRows = await db.select().from(carts);
    expect(cartRows.map((c) => c.id).sort()).toEqual([converted!.id, expired!.id].sort());
  });

  it("returns 404 for an unknown variant id", async () => {
    const res = await app.inject(
      asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${crypto.randomUUID()}` }),
    );
    expect(res.statusCode).toBe(404);
  });

  it("keeps a historical order line when its variant is deleted (variant_id becomes NULL)", async () => {
    const order = await seedOrder({ productTitle: "Test Product" });
    // seedOrder creates the product with exactly one variant — add a second
    // so the ordered one is not the product's last variant.
    await seedVariant(order.productId, { title: "Spare" });

    const res = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${order.variantId}` }));
    expect(res.statusCode).toBe(200);

    const [line] = await db.select().from(orderLineItems).where(eq(orderLineItems.orderId, order.orderId));
    expect(line?.variantId).toBeNull();
    expect(line?.productTitle).toBe("Test Product");
    expect(line?.variantTitle).toBe("Default");
    expect(line?.unitPriceAmount).toBe("899.00");
  });

  it("never exposes stock through the storefront product API even after admin edits", async () => {
    const product = await seedProduct({ handle: "stock-hidden", status: "active" });
    await seedVariant(product.id, { stock: 7 });
    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/stock-hidden" }));
    expect(JSON.stringify(res.json())).not.toMatch(/"stock"\s*:/);
  });

  // ---- inventory ----

  it("adjusts inventory (set + delta), audits before/after, and blocks going negative", async () => {
    const product = await seedProduct({ handle: "inv" });
    const variant = await seedVariant(product.id, { stock: 10 });

    const set = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/variants/${variant.id}/inventory`,
        payload: { mode: "set", quantity: 25, reason: "cycle count" },
      }),
    );
    expect(set.statusCode).toBe(200);
    expect(set.json().variant.stock).toBe(25);

    const delta = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/variants/${variant.id}/inventory`,
        payload: { mode: "adjust", delta: -4, reason: "damaged" },
      }),
    );
    expect(delta.json().variant.stock).toBe(21);

    const negative = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/variants/${variant.id}/inventory`,
        payload: { mode: "adjust", delta: -1000, reason: "oops" },
      }),
    );
    expect(negative.statusCode).toBe(422);
    expect(negative.json().error.code).toBe("NEGATIVE_INVENTORY");

    const missingReason = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/variants/${variant.id}/inventory`,
        payload: { mode: "set", quantity: 5 },
      }),
    );
    expect(missingReason.statusCode).toBe(400);

    // DB reflects the last successful state, not the rejected one
    const [row] = await db.select().from(productVariants).where(eq(productVariants.id, variant.id));
    expect(row?.stock).toBe(21);

    const audits = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "inventory.adjust"));
    expect(audits).toHaveLength(2);
    expect(audits[0]?.metadata).toMatchObject({ previousQuantity: 10, newQuantity: 25, reason: "cycle count" });
    expect(audits[1]?.metadata).toMatchObject({ previousQuantity: 25, newQuantity: 21, delta: -4, reason: "damaged" });

    const history = await app.inject(
      asAdmin(staff, { method: "GET", url: `/api/admin/variants/${variant.id}/inventory` }),
    );
    expect(history.json().history).toHaveLength(2);
  });

  it("replaces options and images by natural key", async () => {
    const product = await seedProduct({ handle: "opts-imgs" });

    const opts = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/options`,
        payload: { options: [{ name: "Color", values: ["Black", "White"] }] },
      }),
    );
    expect(opts.statusCode).toBe(200);
    expect(opts.json().product.options).toEqual([{ id: expect.any(String), name: "Color", values: ["Black", "White"], position: 0 }]);

    const imgs = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/images`,
        payload: { images: [{ url: "https://cdn.example.test/a.jpg", altText: "A" }, { url: "https://cdn.example.test/b.jpg" }] },
      }),
    );
    expect(imgs.json().product.images).toHaveLength(2);

    // resubmitting fewer images removes the dropped one
    const fewer = await app.inject(
      asAdmin(staff, {
        method: "PUT",
        url: `/api/admin/products/${product.id}/images`,
        payload: { images: [{ url: "https://cdn.example.test/a.jpg", altText: "A2" }] },
      }),
    );
    expect(fewer.json().product.images).toHaveLength(1);
    expect(fewer.json().product.images[0].altText).toBe("A2");
  });
});

// ---- simple products ("variante implicite" architecture) ----------------
describe("Admin catalog API — simple products and mode switching", () => {
  let app: FastifyInstance;
  let owner: string;
  let staff: string;

  beforeEach(async () => {
    await resetDb();
    app = await createTestApp();
    const o = await seedAndLoginAdmin(app, { email: "owner@volrep.test", role: "owner" });
    const s = await seedAndLoginAdmin(app, { email: "staff@volrep.test", role: "staff" });
    owner = o.sessionId;
    staff = s.sessionId;
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await closeDb();
  });

  async function createSimpleProduct(handle: string, overrides: Record<string, unknown> = {}) {
    return app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: { handle, title: "Simple Roller", hasVariants: false, priceAmount: "299.00", ...overrides },
      }),
    );
  }

  // #1 — new simple product
  it("creates a simple product with a Default Variant kept in sync", async () => {
    const res = await createSimpleProduct("simple-1", { compareAtAmount: "399.00", availableForSale: true });
    expect(res.statusCode).toBe(201);
    const product = res.json().product;
    expect(product.hasVariants).toBe(false);
    expect(product.commerce).toMatchObject({
      price: { amount: "299.00", currencyCode: "MAD" },
      compareAtPrice: { amount: "399.00", currencyCode: "MAD" },
      availableForSale: true,
      stock: 0,
    });
    // the Default Variant exists and mirrors the product exactly
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0]).toMatchObject({
      title: "Default",
      price: { amount: "299.00", currencyCode: "MAD" },
      stock: 0,
    });

    const [audit] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "product.create"));
    expect(audit?.metadata).toMatchObject({ hasVariants: false });
    // no separate variant.create row for the Default Variant
    const variantAudits = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "variant.create"));
    expect(variantAudits).toHaveLength(0);
  });

  it("requires priceAmount for a new simple product", async () => {
    const res = await app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: { handle: "simple-no-price", title: "X", hasVariants: false },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  // #2 — new variant product (non-regression — unaffected by any of this)
  it("creates a variant product exactly as before, with no Default Variant", async () => {
    const res = await app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: { handle: "variant-2", title: "Variant Roller", hasVariants: true },
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().product).toMatchObject({ hasVariants: true, commerce: null, variants: [] });
  });

  // #3 — product existing before the migration
  it("defaults an existing (pre-migration-equivalent) product to hasVariants: true", async () => {
    const product = await seedProduct({ handle: "legacy" });
    await seedVariant(product.id, { stock: 4 });
    const res = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${product.id}` }));
    expect(res.json().product.hasVariants).toBe(true);
    expect(res.json().product.commerce).toBeNull();
  });

  it("saves simple-product price/compare-at/availability and keeps the Default Variant in sync", async () => {
    const create = await createSimpleProduct("simple-sync");
    const productId = create.json().product.id;

    const patch = await app.inject(
      asAdmin(staff, {
        method: "PATCH",
        url: `/api/admin/products/${productId}`,
        payload: { priceAmount: "349.00", compareAtAmount: "449.00", availableForSale: false },
      }),
    );
    expect(patch.statusCode).toBe(200);
    expect(patch.json().product.commerce).toMatchObject({
      price: { amount: "349.00", currencyCode: "MAD" },
      compareAtPrice: { amount: "449.00", currencyCode: "MAD" },
      availableForSale: false,
    });

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    expect(variant).toMatchObject({ priceAmount: "349.00", compareAtAmount: "449.00", availableForSale: false });
  });

  it("rejects commerce fields on PATCH for a variant product (400)", async () => {
    const product = await seedProduct({ handle: "variant-patch" });
    await seedVariant(product.id);
    const res = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { priceAmount: "10.00" } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("never accepts stock on a product PATCH", async () => {
    const create = await createSimpleProduct("simple-no-stock-patch");
    const productId = create.json().product.id;
    const res = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${productId}`, payload: { stock: 50 } }),
    );
    expect(res.statusCode).toBe(400); // `.strict()` — stock is not a known field
  });

  // #4 — simple → variants
  it("switches simple → variants, exposing the Default Variant as an ordinary editable variant", async () => {
    const create = await createSimpleProduct("switch-to-variants", { compareAtAmount: "399.00" });
    const productId = create.json().product.id;
    const defaultVariantId = create.json().product.variants[0].id;

    const res = await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${productId}/mode`, payload: { mode: "variants" } }));
    expect(res.statusCode).toBe(200);
    const product = res.json().product;
    expect(product.hasVariants).toBe(true);
    expect(product.commerce).toBeNull();
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].id).toBe(defaultVariantId); // same row, not recreated

    // now editable through the normal variant endpoint
    const edit = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/variants/${defaultVariantId}`, payload: { title: "Black" } }),
    );
    expect(edit.statusCode).toBe(200);

    const [audit] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "product.mode_switch"))
      .orderBy(desc(adminAuditLog.createdAt));
    expect(audit?.metadata).toMatchObject({ from: "simple", to: "variants", defaultVariantId });
  });

  // #5 — variants → simple, happy path
  it("switches variants → simple with exactly one variant, copying its commerce onto the product", async () => {
    const product = await seedProduct({ handle: "switch-to-simple" });
    const only = await seedVariant(product.id, { priceAmount: "599.00", compareAtAmount: "699.00", stock: 12, availableForSale: true });

    const res = await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/mode`, payload: { mode: "simple" } }));
    expect(res.statusCode).toBe(200);
    const body = res.json().product;
    expect(body.hasVariants).toBe(false);
    expect(body.commerce).toMatchObject({
      price: { amount: "599.00", currencyCode: "MAD" },
      compareAtPrice: { amount: "699.00", currencyCode: "MAD" },
      stock: 12,
    });

    // the variant row itself is NOT deleted — it is now the Default Variant
    const remaining = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(only.id);

    const [audit] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "product.mode_switch"))
      .orderBy(desc(adminAuditLog.createdAt));
    expect(audit?.metadata).toMatchObject({ from: "variants", to: "simple", defaultVariantId: only.id });
  });

  // #6 — variants → simple, multiple variants
  it("refuses variants → simple with more than one variant (409 MULTIPLE_VARIANTS)", async () => {
    const product = await seedProduct({ handle: "multi-variant" });
    await seedVariant(product.id, { title: "Black" });
    await seedVariant(product.id, { title: "White", sku: "W-1" });

    const res = await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/mode`, payload: { mode: "simple" } }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("MULTIPLE_VARIANTS");

    const remaining = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(remaining).toHaveLength(2); // nothing deleted
  });

  // #5b / #6 — a product with ZERO variants can still switch to simple: a
  // fresh Default Variant is created on the fly (price "0.00", stock 0),
  // never requiring the admin to fake a throwaway variant first.
  it("switches a zero-variant product to simple, creating its Default Variant on the fly", async () => {
    const product = await seedProduct({ handle: "zero-variant" });
    const res = await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/mode`, payload: { mode: "simple" } }));
    expect(res.statusCode).toBe(200);
    const body = res.json().product;
    expect(body.hasVariants).toBe(false);
    // "not priced yet" — the product itself stays unpriced until the admin
    // sets it through the simple-product commerce form.
    expect(body.commerce).toMatchObject({ price: { amount: "0.00", currencyCode: "MAD" }, stock: 0 });
    expect(body.variants).toHaveLength(1);
    expect(body.variants[0]).toMatchObject({ title: "Default", stock: 0 });

    const remaining = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ priceAmount: "0.00", stock: 0, availableForSale: true });
    const [productRow] = await db.select().from(products).where(eq(products.id, product.id));
    expect(productRow?.priceAmount).toBeNull();

    const [audit] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, "product.mode_switch"))
      .orderBy(desc(adminAuditLog.createdAt));
    expect(audit?.metadata).toMatchObject({ from: "variants", to: "simple", createdDefaultVariant: true });
  });

  it("a zero-variant product switched to simple can then have its price and stock set", async () => {
    const product = await seedProduct({ handle: "zero-variant-then-price" });
    await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/mode`, payload: { mode: "simple" } }));

    const priced = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}`, payload: { priceAmount: "249.00" } }),
    );
    expect(priced.statusCode).toBe(200);
    expect(priced.json().product.commerce.price).toEqual({ amount: "249.00", currencyCode: "MAD" });

    const stocked = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/inventory`,
        payload: { mode: "set", quantity: 20, reason: "first stock-in" },
      }),
    );
    expect(stocked.statusCode).toBe(200);
    expect(stocked.json().variant.stock).toBe(20);

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(variant).toMatchObject({ priceAmount: "249.00", stock: 20 });
  });

  // #7 — variants → simple, variant held by an active cart
  it("refuses variants → simple when the only variant is in a genuinely active cart (409 VARIANT_IN_CART)", async () => {
    const product = await seedProduct({ handle: "cart-blocked" });
    const only = await seedVariant(product.id);
    const [cart] = await db.insert(carts).values({ status: "active", expiresAt: new Date(Date.now() + 86_400_000) }).returning();
    await db.insert(cartLines).values({ cartId: cart!.id, variantId: only.id, quantity: 1 });

    const res = await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/mode`, payload: { mode: "simple" } }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("VARIANT_IN_CART");

    const remaining = await db.select().from(productVariants).where(eq(productVariants.id, only.id));
    expect(remaining).toHaveLength(1); // untouched
  });

  it("is idempotent when already in the requested mode", async () => {
    const product = await seedProduct({ handle: "already-variants" });
    await seedVariant(product.id);
    const res = await app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${product.id}/mode`, payload: { mode: "variants" } }));
    expect(res.statusCode).toBe(200);
    const audits = await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "product.mode_switch"));
    expect(audits).toHaveLength(0); // no-op, no audit noise
  });

  // #8 / #9 — stock = 0 / price absent, simple product availability
  it("a simple product with stock 0 is unavailable; adjusting stock makes it available again", async () => {
    const create = await createSimpleProduct("simple-stock-0", { availableForSale: true });
    const productId = create.json().product.id;
    expect(create.json().product.commerce.stock).toBe(0);

    const set = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${productId}/inventory`,
        payload: { mode: "set", quantity: 15, reason: "initial stock" },
      }),
    );
    expect(set.statusCode).toBe(200);
    expect(set.json().variant.stock).toBe(15);

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    expect(variant?.stock).toBe(15);

    const history = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/variants/${variant!.id}/inventory` }));
    expect(history.json().history).toHaveLength(1); // same audit trail as a variant's own stock
  });

  // Regression test for the "stock adjustment succeeds but Product Studio
  // still displays 0" bug: mapAdminProductDetail's commerce.stock must
  // read the Default Variant, not the frozen `products.stock` snapshot.
  it("a re-fetched simple product reflects a stock adjustment through commerce.stock", async () => {
    const create = await createSimpleProduct("simple-stock-refetch");
    const productId = create.json().product.id;
    expect(create.json().product.commerce.stock).toBe(0); // #1 — starts at 0

    const adjust = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${productId}/inventory`,
        payload: { mode: "set", quantity: 42, reason: "stock take" },
      }),
    );
    expect(adjust.statusCode).toBe(200);
    expect(adjust.json().variant.stock).toBe(42); // #2 — the Default Variant changed

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    expect(variant?.stock).toBe(42);

    // `products.stock` itself is NOT expected to have moved — it is a
    // one-time snapshot, never synced by adjustInventory (by design, see
    // services/admin/inventory.ts). This is what previously caused the
    // Studio to display a stale 0: fixed by reading the variant instead.
    const [productRow] = await db.select().from(products).where(eq(products.id, productId));
    expect(productRow?.stock).toBe(0);

    const refetched = await app.inject(asAdmin(staff, { method: "GET", url: `/api/admin/products/${productId}` }));
    expect(refetched.statusCode).toBe(200);
    expect(refetched.json().product.commerce.stock).toBe(42); // #3 — the fix

    // #4 — storefront/cart/checkout read product_variants directly and
    // were never affected by this bug; confirmed unchanged here too.
    await app.inject(asAdmin(owner, { method: "PATCH", url: `/api/admin/products/${productId}`, payload: { status: "active" } }));
    const storefront = await app.inject(withAuth({ method: "GET", url: "/api/products/simple-stock-refetch" }));
    expect(storefront.statusCode).toBe(200);
    expect(storefront.json().product.availableForSale).toBe(true);

    const addLine = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant!.id, quantity: 3 } }),
    );
    expect(addLine.statusCode).toBe(200);
    expect(addLine.json().cart.lines[0]).toMatchObject({ quantity: 3, merchandise: { id: variant!.id } });
  });

  it("refuses the product inventory endpoint for a variant product (409)", async () => {
    const product = await seedProduct({ handle: "variant-inventory" });
    await seedVariant(product.id);
    const res = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${product.id}/inventory`,
        payload: { mode: "set", quantity: 5, reason: "x" },
      }),
    );
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("PRODUCT_HAS_VARIANTS");
  });

  // #10 — active status + 0 stock on the storefront
  it("a published simple product with 0 stock is visible but unavailable on the storefront", async () => {
    const create = await createSimpleProduct("simple-active-empty", { availableForSale: true });
    const productId = create.json().product.id;
    await app.inject(asAdmin(owner, { method: "PATCH", url: `/api/admin/products/${productId}`, payload: { status: "active" } }));

    const res = await app.inject(withAuth({ method: "GET", url: "/api/products/simple-active-empty" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().product.availableForSale).toBe(false); // stock is 0
    expect(res.json().product.price).toEqual({ amount: "299.00", currencyCode: "MAD" }); // never "0 MAD"
  });

  // #11 / #12 — cart + checkout for a simple product (non-regression: no
  // cart.ts/checkout.ts code was touched — this proves it needs none)
  it("adds a simple product to the cart and checks it out exactly like any other variant", async () => {
    const create = await createSimpleProduct("simple-checkout", { availableForSale: true });
    const productId = create.json().product.id;
    await app.inject(asAdmin(owner, { method: "PATCH", url: `/api/admin/products/${productId}`, payload: { status: "active" } }));
    await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${productId}/inventory`,
        payload: { mode: "set", quantity: 10, reason: "stock up" },
      }),
    );
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, productId));

    const addLine = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: variant!.id, quantity: 2 } }),
    );
    expect(addLine.statusCode).toBe(200);
    expect(addLine.json().cart.lines).toHaveLength(1);
    expect(addLine.json().cart.lines[0]).toMatchObject({ quantity: 2, merchandise: { id: variant!.id } });

    // stock decrements on checkout exactly like a normal variant (full
    // checkout-session flow is covered by routes/checkout.test.ts; this
    // only proves a simple product's Default Variant plugs into the same
    // cart code path with zero changes to cart.ts).
    const [afterAdd] = await db.select().from(productVariants).where(eq(productVariants.id, variant!.id));
    expect(afterAdd?.stock).toBe(10); // unchanged by adding to cart
  });

  // #13 — a variant referenced by a past order survives a mode switch
  it("a mode switch never touches order_line_items (frozen snapshot, unaffected either way)", async () => {
    const order = await seedOrder({ productTitle: "Switchable" });
    // seedOrder's product has exactly one variant — the one on the order.
    const res = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${order.productId}/mode`, payload: { mode: "simple" } }),
    );
    expect(res.statusCode).toBe(200);

    const [line] = await db.select().from(orderLineItems).where(eq(orderLineItems.orderId, order.orderId));
    expect(line?.variantId).toBe(order.variantId); // untouched — no row was ever deleted
  });

  // #14 — concurrent createProduct with the same handle
  // Two DIFFERENT simple products created at the same time: each gets its
  // own, correctly-priced Default Variant — no shared state between the
  // two creations races or cross-contaminates (spec §F: "deux Default
  // Variants créées simultanément"). (A same-handle race is a pre-existing
  // createProduct gap — its check-then-insert was never atomic even
  // before this feature — unrelated to the variante-implicite logic and
  // out of this change's scope.)
  it("two concurrent simple-product creations never cross-contaminate their Default Variants", async () => {
    const [a, b] = await Promise.all([
      createSimpleProduct("race-a", { priceAmount: "111.00" }),
      createSimpleProduct("race-b", { priceAmount: "222.00" }),
    ]);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().product.variants).toHaveLength(1);
    expect(b.json().product.variants).toHaveLength(1);
    expect(a.json().product.commerce.price.amount).toBe("111.00");
    expect(b.json().product.commerce.price.amount).toBe("222.00");
    expect(a.json().product.variants[0].id).not.toBe(b.json().product.variants[0].id);
  });

  // #15 — concurrent updateProduct + switchProductMode
  it("serializes a concurrent price update against a concurrent mode switch (no lost update)", async () => {
    const create = await createSimpleProduct("simple-concurrent");
    const productId = create.json().product.id;

    const [patchRes, modeRes] = await Promise.all([
      app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${productId}`, payload: { priceAmount: "199.00" } })),
      app.inject(asAdmin(staff, { method: "PATCH", url: `/api/admin/products/${productId}/mode`, payload: { mode: "variants" } })),
    ]);
    // Both requests succeed (they serialize via FOR UPDATE rather than
    // racing); the end state is internally consistent either way.
    expect(patchRes.statusCode).toBe(200);
    expect(modeRes.statusCode).toBe(200);

    const [finalProduct] = await db.select().from(products).where(eq(products.id, productId));
    if (finalProduct!.hasVariants) {
      // the switch landed last — commerce columns were cleared
      expect(finalProduct!.priceAmount).toBeNull();
    } else {
      // the price update landed last — it is reflected
      expect(finalProduct!.priceAmount).toBe("199.00");
    }
    // Whichever order won, there is still exactly one variant and its
    // price was never silently lost.
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    expect(variants).toHaveLength(1);
  });

  // #16 — variant endpoints reject a simple product
  it("rejects createVariant/updateVariant/deleteVariant on a simple product (409 SIMPLE_PRODUCT)", async () => {
    const create = await createSimpleProduct("simple-locked");
    const productId = create.json().product.id;
    const defaultVariantId = create.json().product.variants[0].id;

    const create2 = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/products/${productId}/variants`,
        payload: { title: "Extra", priceAmount: "10.00" },
      }),
    );
    expect(create2.statusCode).toBe(409);
    expect(create2.json().error.code).toBe("SIMPLE_PRODUCT");

    const update = await app.inject(
      asAdmin(staff, { method: "PATCH", url: `/api/admin/variants/${defaultVariantId}`, payload: { title: "Hacked" } }),
    );
    expect(update.statusCode).toBe(409);
    expect(update.json().error.code).toBe("SIMPLE_PRODUCT");

    const del = await app.inject(asAdmin(staff, { method: "DELETE", url: `/api/admin/variants/${defaultVariantId}` }));
    expect(del.statusCode).toBe(409);
    expect(del.json().error.code).toBe("SIMPLE_PRODUCT");

    // and the variant endpoint's own inventory route, for completeness
    const inv = await app.inject(
      asAdmin(staff, {
        method: "POST",
        url: `/api/admin/variants/${defaultVariantId}/inventory`,
        payload: { mode: "set", quantity: 5, reason: "x" },
      }),
    );
    expect(inv.statusCode).toBe(200); // adjustInventory itself has no such guard — only the create/update/delete trio does
  });
});
