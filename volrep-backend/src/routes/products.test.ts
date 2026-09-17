import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedImage, seedOption, seedProduct, seedVariant } from "../test/seed.js";
import { closeDb } from "../db/client.js";

describe("Products API", () => {
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

  it("requires the internal API key", async () => {
    const response = await app.inject({ method: "GET", url: "/api/products" });
    expect(response.statusCode).toBe(401);
  });

  it("lists only active products", async () => {
    const active = await seedProduct({ handle: "active-product", status: "active" });
    await seedVariant(active.id);
    await seedProduct({ handle: "draft-product", status: "draft" });
    await seedProduct({ handle: "archived-product", status: "archived" });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/products" }));
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].handle).toBe("active-product");
  });

  it("returns a product summary shaped for the frontend migration contract", async () => {
    const product = await seedProduct({ productType: "Recovery", tags: ["a", "b"] });
    await seedVariant(product.id, { priceAmount: "500.00" });
    await seedImage(product.id, { url: "https://cdn.example.com/featured.jpg", altText: "Featured" });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/products" }));
    const [summary] = response.json().products;

    expect(summary).toMatchObject({
      handle: "volrep-prm",
      title: "VOLREP PRM",
      productType: "Recovery",
      tags: ["a", "b"],
      featuredImage: { url: "https://cdn.example.com/featured.jpg", altText: "Featured" },
      priceRange: { minVariantPrice: { amount: "500.00", currencyCode: "MAD" } },
    });
  });

  it("looks up a product by handle with images, options, and variants", async () => {
    const product = await seedProduct();
    await seedImage(product.id, { position: 0, url: "https://cdn.example.com/1.jpg" });
    await seedImage(product.id, { position: 1, url: "https://cdn.example.com/2.jpg" });
    await seedOption(product.id, { name: "Color", values: ["Black", "White"] });
    await seedVariant(product.id, { title: "Black", selectedOptions: [{ name: "Color", value: "Black" }] });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/products/volrep-prm" }));
    expect(response.statusCode).toBe(200);

    const { product: body } = response.json();
    expect(body.handle).toBe("volrep-prm");
    expect(body.images).toHaveLength(2);
    expect(body.options).toEqual([{ id: expect.any(String), name: "Color", values: ["Black", "White"] }]);
    expect(body.variants).toHaveLength(1);
    expect(body.variants[0]).toMatchObject({
      title: "Black",
      selectedOptions: [{ name: "Color", value: "Black" }],
      availableForSale: true,
    });
  });

  it("returns 404 for an unknown handle", async () => {
    const response = await app.inject(withAuth({ method: "GET", url: "/api/products/does-not-exist" }));
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for an unpublished (draft) product — same as unknown", async () => {
    await seedProduct({ handle: "hidden-product", status: "draft" });
    const response = await app.inject(withAuth({ method: "GET", url: "/api/products/hidden-product" }));
    expect(response.statusCode).toBe(404);
  });

  it("computes variant availability from both the override flag and stock", async () => {
    const product = await seedProduct();
    await seedVariant(product.id, { title: "In stock", stock: 5, availableForSale: true });
    await seedVariant(product.id, { title: "Out of stock", stock: 0, availableForSale: true });
    await seedVariant(product.id, { title: "Disabled", stock: 5, availableForSale: false });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/products/volrep-prm" }));
    const { product: body } = response.json();

    const byTitle = Object.fromEntries(body.variants.map((v: { title: string; availableForSale: boolean }) => [v.title, v.availableForSale]));
    expect(byTitle).toEqual({ "In stock": true, "Out of stock": false, Disabled: false });

    // Product-level availableForSale is true as long as at least one
    // variant is purchasable.
    expect(body.availableForSale).toBe(true);
  });

  it("never exposes raw stock counts on the public API", async () => {
    const product = await seedProduct();
    await seedVariant(product.id, { stock: 7 });

    const response = await app.inject(withAuth({ method: "GET", url: "/api/products/volrep-prm" }));
    const { product: body } = response.json();
    expect(Object.keys(body.variants[0])).not.toContain("stock");
    expect(JSON.stringify(body)).not.toMatch(/"stock"\s*:/);
  });
});
