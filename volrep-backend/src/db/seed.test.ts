import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApp, withAuth } from "../test/test-app.js";
import { resetDb } from "../test/reset-db.js";
import { seedShipping } from "../test/seed.js";
import { closeDb, db } from "./client.js";
import { productImages, productOptions, productVariants, products, reviews } from "./schema/index.js";
import { DEV_TEST_STOCK, seedCatalog, VOLREP_PRM_HANDLE } from "./seed.js";

// Proves the VOLREP catalog seed produces a product the storefront API can
// actually serve, sell, and check out — and that re-running it is safe.
describe("VOLREP catalog seed", () => {
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

  type ApiVariant = { id: string; title: string; availableForSale: boolean; price: unknown; compareAtPrice: unknown };

  async function getDetail() {
    const response = await app.inject(withAuth({ method: "GET", url: `/api/products/${VOLREP_PRM_HANDLE}` }));
    return response.json().product as {
      title: string;
      description: string;
      images: unknown[];
      options: { id: string; name: string; values: string[] }[];
      variants: ApiVariant[];
      price: unknown;
      compareAtPrice: unknown;
    };
  }

  it("creates the VOLREP PRM product (1)", async () => {
    const result = await seedCatalog();
    expect(result.created).toBe(true);

    const [row] = await db.select().from(products).where(eq(products.handle, VOLREP_PRM_HANDLE));
    expect(row).toMatchObject({
      handle: "volrep-prm",
      title: "Volrep PRM™ Percussive Recovery Massager",
      productType: "Recovery",
      status: "active",
    });
  });

  it("is returned by GET /api/products (2)", async () => {
    await seedCatalog();

    const response = await app.inject(withAuth({ method: "GET", url: "/api/products" }));
    expect(response.statusCode).toBe(200);

    const { products: list } = response.json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      handle: "volrep-prm",
      title: "Volrep PRM™ Percussive Recovery Massager",
      productType: "Recovery",
      priceRange: { minVariantPrice: { amount: "899.00", currencyCode: "MAD" } },
    });
  });

  it("is returned by GET /api/products/volrep-prm with images, options and variants (3, 4)", async () => {
    await seedCatalog();
    const product = await getDetail();

    expect(product.description).toContain("Advanced 4D massage roller");
    expect(product.images).toHaveLength(2);
    expect(product.options).toEqual([{ id: expect.any(String), name: "Color", values: ["Black", "White"] }]);
    expect(product.variants.map((variant) => variant.title).sort()).toEqual(["Black", "White"]);
    expect(product.variants.every((variant) => variant.availableForSale)).toBe(true);
  });

  it("prices every variant at 899.00 MAD with a genuine 1099.00 compare-at (5)", async () => {
    await seedCatalog();
    const product = await getDetail();

    for (const variant of product.variants) {
      expect(variant.price).toEqual({ amount: "899.00", currencyCode: "MAD" });
      expect(variant.compareAtPrice).toEqual({ amount: "1099.00", currencyCode: "MAD" });
    }
    expect(product.price).toEqual({ amount: "899.00", currencyCode: "MAD" });
    expect(product.compareAtPrice).toEqual({ amount: "1099.00", currencyCode: "MAD" });
  });

  it("never exposes raw stock counts through the public product API", async () => {
    await seedCatalog();
    const response = await app.inject(withAuth({ method: "GET", url: `/api/products/${VOLREP_PRM_HANDLE}` }));
    expect(JSON.stringify(response.json())).not.toMatch(/"stock"\s*:/);
  });

  it("adds a purchasable variant to the cart with totals computed from DB prices (6, 7)", async () => {
    await seedCatalog();
    const product = await getDetail();
    const black = product.variants.find((variant) => variant.title === "Black")!;

    const response = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: black.id, quantity: 2 } }),
    );
    expect(response.statusCode).toBe(200);

    const { cart } = response.json();
    expect(cart.totalQuantity).toBe(2);
    expect(cart.lines).toHaveLength(1);
    // 2 x 899.00, straight from product_variants.price_amount — the request
    // carried no price at all.
    expect(cart.lines[0].cost.totalAmount).toEqual({ amount: "1798.00", currencyCode: "MAD" });
    expect(cart.cost.subtotalAmount).toEqual({ amount: "1798.00", currencyCode: "MAD" });
  });

  it("supports a COD checkout from the seeded product and decrements stock (8, 9)", async () => {
    await seedCatalog();
    await seedShipping({ countryCode: "MA", flatRateAmount: "30.00" });

    const product = await getDetail();
    const black = product.variants.find((variant) => variant.title === "Black")!;

    const add = await app.inject(
      withAuth({ method: "POST", url: "/api/cart/lines", payload: { variantId: black.id, quantity: 3 } }),
    );
    const cartId = add.json().cart.id as string;

    const checkout = await app.inject(
      withAuth({
        method: "POST",
        url: "/api/checkout/session",
        payload: {
          cartId,
          email: "buyer@example.com",
          phone: "+212600000000",
          shippingAddress: { line1: "1 Rue Test", city: "Casablanca", country: "MA" },
        },
      }),
    );
    expect(checkout.statusCode).toBe(201);

    const { order } = checkout.json();
    expect(order.subtotalAmount).toEqual({ amount: "2697.00", currencyCode: "MAD" }); // 3 x 899.00
    expect(order.shippingAmount).toEqual({ amount: "30.00", currencyCode: "MAD" });
    expect(order.totalAmount).toEqual({ amount: "2727.00", currencyCode: "MAD" });
    expect(order.paymentProvider).toBe("cod");

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, black.id));
    expect(variant?.stock).toBe(DEV_TEST_STOCK - 3);
  });

  it("does not duplicate catalog records when run repeatedly (10)", async () => {
    const first = await seedCatalog();
    const second = await seedCatalog();
    const third = await seedCatalog();

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(third.created).toBe(false);
    expect(second.productId).toBe(first.productId);
    expect(third.variantIdsByTitle).toEqual(first.variantIdsByTitle);

    expect(await db.select().from(products)).toHaveLength(1);
    expect(await db.select().from(productVariants)).toHaveLength(2);
    expect(await db.select().from(productImages)).toHaveLength(2);
    expect(await db.select().from(productOptions)).toHaveLength(1);
  });

  it("reconciles a pre-existing SKU-less variant in place instead of duplicating it", async () => {
    // Mimics the manual dev insert that existed before this seed: right
    // handle, right variant titles, but no SKUs and stale prices.
    const [product] = await db
      .insert(products)
      .values({ handle: VOLREP_PRM_HANDLE, title: "VOLREP PRM", status: "active" })
      .returning();
    await db.insert(productVariants).values([
      { productId: product!.id, title: "Black", selectedOptions: [{ name: "Color", value: "Black" }], priceAmount: "1.00", stock: 0 },
      { productId: product!.id, title: "White", selectedOptions: [{ name: "Color", value: "White" }], priceAmount: "1.00", stock: 0 },
    ]);

    const result = await seedCatalog();
    expect(result.created).toBe(false);

    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, product!.id));
    expect(variants).toHaveLength(2);
    expect(variants.map((variant) => variant.sku).sort()).toEqual(["VOLREP-PRM-BLK", "VOLREP-PRM-WHT"]);
    expect(variants.every((variant) => variant.priceAmount === "899.00")).toBe(true);
    expect(variants.every((variant) => variant.stock === DEV_TEST_STOCK)).toBe(true);
  });

  it("leaves reviews empty and strips fabricated (order-less) reviews", async () => {
    const first = await seedCatalog();

    await db.insert(reviews).values({
      productId: first.productId,
      author: "Manual Test",
      rating: 5,
      body: "dev noise",
      status: "approved",
    });

    const second = await seedCatalog();
    expect(second.removedFabricatedReviews).toBe(1);

    const response = await app.inject(withAuth({ method: "GET", url: `/api/reviews/${VOLREP_PRM_HANDLE}` }));
    expect(response.json()).toEqual({ reviews: [], averageRating: null, reviewCount: 0 });
  });
});
