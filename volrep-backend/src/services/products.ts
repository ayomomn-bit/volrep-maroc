import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { productImages, productOptions, products, productVariants } from "../db/schema/index.js";
import { mapProductDetail, mapProductSummary, type ApiProduct, type ApiProductSummary } from "../mappers/product.js";

// Only ever "active" — draft/archived products are admin-only and never
// reach the storefront API (Phase 4 requirement).
export async function listProducts(limit: number): Promise<ApiProductSummary[]> {
  const activeProducts = await db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  if (activeProducts.length === 0) return [];

  const productIds = activeProducts.map((p) => p.id);

  const priceRows = await db
    .select({
      productId: productVariants.productId,
      minPrice: sql<string>`min(${productVariants.priceAmount})`,
      currency: sql<string>`min(${productVariants.priceCurrency})`,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))
    .groupBy(productVariants.productId);
  const priceByProduct = new Map(priceRows.map((row) => [row.productId, row]));

  const imageRows = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(asc(productImages.position));
  const featuredImageByProduct = new Map<string, (typeof imageRows)[number]>();
  for (const image of imageRows) {
    if (!featuredImageByProduct.has(image.productId)) featuredImageByProduct.set(image.productId, image);
  }

  return activeProducts.map((product) =>
    mapProductSummary(product, priceByProduct.get(product.id) ?? null, featuredImageByProduct.get(product.id) ?? null),
  );
}

export async function getProductByHandle(handle: string): Promise<ApiProduct | null> {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.handle, handle), eq(products.status, "active")))
    .limit(1);

  if (!product) return null;

  const [images, options, variants] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.position)),
    db.select().from(productOptions).where(eq(productOptions.productId, product.id)).orderBy(asc(productOptions.position)),
    db.select().from(productVariants).where(eq(productVariants.productId, product.id)).orderBy(asc(productVariants.position)),
  ]);

  const imageById = new Map(images.map((image) => [image.id, image]));

  return mapProductDetail(product, images, options, variants, imageById);
}
