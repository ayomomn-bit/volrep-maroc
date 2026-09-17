import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../../test/test-app.js";
import { resetDb } from "../../test/reset-db.js";
import { asAdmin, seedAndLoginAdmin, seedOrder } from "../../test/admin.js";
import { seedProduct, seedVariant } from "../../test/seed.js";
import { closeDb, db } from "../../db/client.js";
import { adminAuditLog, cartLines, carts, orderLineItems, productVariants } from "../../db/schema/index.js";

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
  afterAll(async () => {
    await closeDb();
  });

  // ---- products ----

  it("creates a product (owner), lists it, and returns full detail", async () => {
    const create = await app.inject(
      asAdmin(owner, {
        method: "POST",
        url: "/api/admin/products",
        payload: { handle: "test-roller", title: "Test Roller", productType: "Recovery", tags: ["a"], status: "draft" },
      }),
    );
    expect(create.statusCode).toBe(201);
    const id = create.json().product.id;

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
      asAdmin(owner, { method: "POST", url: "/api/admin/products", payload: { handle: "taken", title: "Dup" } }),
    );
    expect(res.statusCode).toBe(409);
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
