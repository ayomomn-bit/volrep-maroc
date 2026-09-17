import { db } from "../db/client.js";
import {
  homepage,
  HOMEPAGE_ID,
  productImages,
  productLandingPages,
  productOptions,
  productPages,
  productVariants,
  products,
  shippingSettings,
  siteMedia,
} from "../db/schema/index.js";
import { DEFAULT_PAGE_DOCUMENT } from "../lib/product-page/defaults.js";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "../lib/homepage/defaults.js";

type ProductInsert = typeof products.$inferInsert;
type VariantInsert = typeof productVariants.$inferInsert;

export async function seedProduct(overrides: Partial<ProductInsert> = {}) {
  const [product] = await db
    .insert(products)
    .values({
      handle: "volrep-prm",
      title: "VOLREP PRM",
      description: "Percussive recovery massager",
      productType: "Recovery",
      tags: ["recovery", "massager"],
      status: "active",
      ...overrides,
    })
    .returning();
  if (!product) throw new Error("seed failed: product");
  return product;
}

export async function seedVariant(productId: string, overrides: Partial<VariantInsert> = {}) {
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId,
      title: "Default",
      selectedOptions: [],
      priceAmount: "899.00",
      priceCurrency: "MAD",
      stock: 10,
      availableForSale: true,
      ...overrides,
    })
    .returning();
  if (!variant) throw new Error("seed failed: variant");
  return variant;
}

export async function seedImage(productId: string, overrides: Partial<typeof productImages.$inferInsert> = {}) {
  const [image] = await db
    .insert(productImages)
    .values({ productId, url: "https://cdn.example.com/img.jpg", position: 0, ...overrides })
    .returning();
  if (!image) throw new Error("seed failed: image");
  return image;
}

export async function seedShipping(overrides: Partial<typeof shippingSettings.$inferInsert> = {}) {
  const [row] = await db
    .insert(shippingSettings)
    .values({ countryCode: "MA", flatRateAmount: "0", currency: "MAD", active: true, ...overrides })
    .returning();
  if (!row) throw new Error("seed failed: shipping");
  return row;
}

export async function seedOption(productId: string, overrides: Partial<typeof productOptions.$inferInsert> = {}) {
  const [option] = await db
    .insert(productOptions)
    .values({ productId, name: "Color", values: ["Black", "White"], position: 0, ...overrides })
    .returning();
  if (!option) throw new Error("seed failed: option");
  return option;
}


export async function seedProductPage(
  productId: string,
  overrides: Partial<typeof productPages.$inferInsert> = {},
) {
  const [row] = await db
    .insert(productPages)
    .values({
      productId,
      draft: DEFAULT_PAGE_DOCUMENT,
      published: DEFAULT_PAGE_DOCUMENT,
      publishedAt: new Date(),
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("seed failed: product page");
  return row;
}

export async function seedSiteMedia(overrides: Partial<typeof siteMedia.$inferInsert> = {}) {
  const checksum =
    overrides.checksum ?? `deadbeef${Math.random().toString(16).slice(2).padEnd(56, "0").slice(0, 56)}`;
  const [row] = await db
    .insert(siteMedia)
    .values({
      url: `http://media.test/site/${checksum}.png`,
      storageKey: `site/${checksum}.png`,
      contentType: "image/png",
      checksum,
      byteSize: 69,
      mediaType: "image",
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("seed failed: site media");
  return row;
}

export async function seedHomepage(overrides: Partial<typeof homepage.$inferInsert> = {}) {
  const [row] = await db
    .insert(homepage)
    .values({
      id: HOMEPAGE_ID,
      draft: DEFAULT_HOMEPAGE_DOCUMENT,
      ...overrides,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.select().from(homepage))[0]!;
}

export async function seedLandingPage(
  productId: string,
  overrides: Partial<typeof productLandingPages.$inferInsert> = {},
) {
  const [row] = await db
    .insert(productLandingPages)
    .values({
      productId,
      liryaPageId: "pg_test",
      role: "primary",
      cachedStatus: "published",
      cachedPublicUrl: "https://lirya.example/p/test",
      cachedSlug: "test-landing",
      cachedName: "Test landing",
      cachedTemplate: "classic",
      cachedContentSource: "legacy_html",
      cachedEtag: '"pg_test:1"',
      liryaVersion: "1",
      lastSyncedAt: new Date(),
      lastCheckedAt: new Date(),
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("seed failed: landing page");
  return row;
}
