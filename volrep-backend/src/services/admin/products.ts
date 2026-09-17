import { and, asc, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { productImages, productOptions, productVariants, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminProductDetail, mapAdminProductSummary } from "../../mappers/admin.js";
import { toMoney } from "../../lib/money.js";
import type { AdminContext } from "./auth.js";

export type ProductStatus = "draft" | "active" | "archived";
const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listProducts(opts: { status?: ProductStatus | undefined; limit: number; offset: number }) {
  const where = opts.status ? eq(products.status, opts.status) : undefined;
  const [rows, [totalRow]] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(opts.limit).offset(opts.offset),
    db.select({ value: count() }).from(products).where(where),
  ]);

  const ids = rows.map((r) => r.id);

  // One grouped pass for variant aggregates, one for the featured image —
  // so the list can show a thumbnail, price range and stock without an
  // N+1 fan-out over the page.
  const [variantAgg, featuredImages] = ids.length
    ? await Promise.all([
        db
          .select({
            productId: productVariants.productId,
            variantCount: count(),
            totalStock: sql<number>`coalesce(sum(${productVariants.stock}), 0)::int`,
            minPrice: sql<string | null>`min(${productVariants.priceAmount})::text`,
            maxPrice: sql<string | null>`max(${productVariants.priceAmount})::text`,
            currency: sql<string | null>`min(${productVariants.priceCurrency})`,
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, ids))
          .groupBy(productVariants.productId),
        db
          .select({ productId: productImages.productId, url: productImages.url })
          .from(productImages)
          .where(inArray(productImages.productId, ids))
          .orderBy(asc(productImages.productId), asc(productImages.position)),
      ])
    : [[], []];

  const aggByProduct = new Map(variantAgg.map((a) => [a.productId, a]));
  const imageByProduct = new Map<string, string>();
  for (const img of featuredImages) {
    if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url);
  }

  return {
    products: rows.map((row) => {
      const agg = aggByProduct.get(row.id);
      const currency = agg?.currency ?? "MAD";
      return mapAdminProductSummary(row, {
        variantCount: agg?.variantCount ?? 0,
        totalStock: agg?.totalStock ?? 0,
        priceRange:
          agg?.minPrice != null && agg.maxPrice != null
            ? { min: toMoney(agg.minPrice, currency), max: toMoney(agg.maxPrice, currency) }
            : null,
        featuredImageUrl: imageByProduct.get(row.id) ?? null,
      });
    }),
    total: totalRow?.value ?? 0,
    limit: opts.limit,
    offset: opts.offset,
  };
}

async function loadProductOr404(productId: string) {
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!row) throw AppError.notFound("Product not found");
  return row;
}

export async function getProductDetail(productId: string) {
  const product = await loadProductOr404(productId);
  const [images, options, variants] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.position)),
    db.select().from(productOptions).where(eq(productOptions.productId, product.id)).orderBy(asc(productOptions.position)),
    db.select().from(productVariants).where(eq(productVariants.productId, product.id)).orderBy(asc(productVariants.position)),
  ]);
  return mapAdminProductDetail(product, images, options, variants);
}

export type CreateProductInput = {
  handle: string;
  title: string;
  description?: string | undefined;
  productType?: string | undefined;
  tags?: string[] | undefined;
  status?: ProductStatus | undefined;
};

export async function createProduct(admin: AdminContext, input: CreateProductInput) {
  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.handle, input.handle)).limit(1);
  if (existing) throw new AppError(409, "HANDLE_TAKEN", `A product with handle "${input.handle}" already exists.`);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        handle: input.handle,
        title: input.title,
        description: input.description ?? "",
        productType: input.productType ?? "",
        tags: input.tags ?? [],
        status: input.status ?? "draft",
      })
      .returning();
    if (!row) throw new Error("Product insert returned no row");

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.create",
      entityType: "product",
      entityId: row.id,
      metadata: { handle: row.handle, title: row.title, status: row.status },
    });

    return mapAdminProductDetail(row, [], [], []);
  });
}

export type UpdateProductInput = {
  handle?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  productType?: string | undefined;
  tags?: string[] | undefined;
  status?: ProductStatus | undefined;
  // `subtitle` (accroche) kept as product metadata; richer marketing
  // content (marketing copy / benefits / selling points / SEO) lives in
  // Lirya and is no longer edited here.
  subtitle?: string | undefined;
};

export async function updateProduct(admin: AdminContext, productId: string, input: UpdateProductInput) {
  const current = await loadProductOr404(productId);

  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  const changed: Record<string, { from: unknown; to: unknown }> = {};

  if (input.handle !== undefined && input.handle !== current.handle) {
    if (!HANDLE_RE.test(input.handle)) {
      throw AppError.badRequest("Handle must be lowercase letters, digits and single hyphens.");
    }
    const [taken] = await db.select({ id: products.id }).from(products).where(eq(products.handle, input.handle)).limit(1);
    if (taken) throw new AppError(409, "HANDLE_TAKEN", `A product with handle "${input.handle}" already exists.`);
    patch.handle = input.handle;
    changed.handle = { from: current.handle, to: input.handle };
  }
  if (input.title !== undefined && input.title !== current.title) {
    patch.title = input.title;
    changed.title = { from: current.title, to: input.title };
  }
  if (input.description !== undefined && input.description !== current.description) {
    patch.description = input.description;
    changed.description = { from: current.description, to: input.description };
  }
  if (input.productType !== undefined && input.productType !== current.productType) {
    patch.productType = input.productType;
    changed.productType = { from: current.productType, to: input.productType };
  }
  if (input.tags !== undefined && JSON.stringify(input.tags) !== JSON.stringify(current.tags)) {
    patch.tags = input.tags;
    changed.tags = { from: current.tags, to: input.tags };
  }
  if (input.status !== undefined && input.status !== current.status) {
    patch.status = input.status;
    changed.status = { from: current.status, to: input.status };
  }
  if (input.subtitle !== undefined && input.subtitle !== current.subtitle) {
    patch.subtitle = input.subtitle;
    changed.subtitle = { from: current.subtitle, to: input.subtitle };
  }

  if (Object.keys(changed).length === 0) {
    return getProductDetail(productId);
  }

  return db.transaction(async (tx) => {
    await tx.update(products).set(patch).where(eq(products.id, productId));

    const action = "status" in changed && Object.keys(changed).length === 1 ? "product.status_change" : "product.update";
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action,
      entityType: "product",
      entityId: productId,
      metadata: { changed },
    });

    const [product, images, options, variants] = await Promise.all([
      tx.select().from(products).where(eq(products.id, productId)).limit(1),
      tx.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position)),
      tx.select().from(productOptions).where(eq(productOptions.productId, productId)).orderBy(asc(productOptions.position)),
      tx.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.position)),
    ]);
    return mapAdminProductDetail(product[0]!, images, options, variants);
  });
}

// Replace the product's option set. Reconciled by (product_id, name) so an
// option keeps its id (and any existing value list is overwritten).
export type OptionInput = { name: string; values: string[]; position?: number | undefined };

export async function replaceOptions(admin: AdminContext, productId: string, optionsInput: OptionInput[]) {
  await loadProductOr404(productId);
  const names = optionsInput.map((o) => o.name);
  if (new Set(names).size !== names.length) {
    throw AppError.badRequest("Duplicate option names are not allowed.");
  }

  await db.transaction(async (tx) => {
    if (names.length > 0) {
      await tx.delete(productOptions).where(and(eq(productOptions.productId, productId), notInArray(productOptions.name, names)));
    } else {
      await tx.delete(productOptions).where(eq(productOptions.productId, productId));
    }

    for (const [index, option] of optionsInput.entries()) {
      await tx
        .insert(productOptions)
        .values({ productId, name: option.name, values: option.values, position: option.position ?? index })
        .onConflictDoUpdate({
          target: [productOptions.productId, productOptions.name],
          set: { values: option.values, position: option.position ?? index },
        });
    }

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.options_update",
      entityType: "product",
      entityId: productId,
      metadata: { options: optionsInput },
    });
  });

  return getProductDetail(productId);
}

// Replace the product's image set. Matched by URL so an image keeps its id
// (and therefore any variant.imageId still points at it) when the same URL
// is re-submitted. No upload — URLs are supplied by the admin.
export type ImageInput = {
  url: string;
  altText?: string | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  position?: number | undefined;
};

export async function replaceImages(admin: AdminContext, productId: string, imagesInput: ImageInput[]) {
  await loadProductOr404(productId);

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(productImages).where(eq(productImages.productId, productId));
    const byUrl = new Map(existing.map((img) => [img.url, img]));
    const keptIds: string[] = [];

    for (const [index, image] of imagesInput.entries()) {
      const position = image.position ?? index;
      const found = byUrl.get(image.url);
      if (found) {
        await tx
          .update(productImages)
          .set({
            altText: image.altText !== undefined ? image.altText : found.altText,
            width: image.width !== undefined ? image.width : found.width,
            height: image.height !== undefined ? image.height : found.height,
            position,
          })
          .where(eq(productImages.id, found.id));
        keptIds.push(found.id);
      } else {
        const [inserted] = await tx
          .insert(productImages)
          .values({
            productId,
            url: image.url,
            altText: image.altText ?? null,
            width: image.width ?? null,
            height: image.height ?? null,
            position,
          })
          .returning({ id: productImages.id });
        if (inserted) keptIds.push(inserted.id);
      }
    }

    if (keptIds.length > 0) {
      await tx.delete(productImages).where(and(eq(productImages.productId, productId), notInArray(productImages.id, keptIds)));
    } else {
      await tx.delete(productImages).where(eq(productImages.productId, productId));
    }

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.images_update",
      entityType: "product",
      entityId: productId,
      metadata: { imageCount: imagesInput.length, urls: imagesInput.map((i) => i.url) },
    });
  });

  return getProductDetail(productId);
}
