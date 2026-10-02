import { and, asc, count, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { cartLines, carts, productImages, productOptions, productVariants, products } from "../../db/schema/index.js";
import { recordAudit } from "../../lib/audit.js";
import { mapAdminProductDetail, mapAdminProductSummary } from "../../mappers/admin.js";
import { toMoney } from "../../lib/money.js";
import { assertCompareAtAbovePrice, assertMoneyString } from "./variants.js";
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
  // Required (see routes/admin/products.ts's createProductSchema) — every
  // new product explicitly picks "simple" or "with variants" up front.
  hasVariants: boolean;
  // Simple-product commerce (hasVariants: false only). `priceAmount` is
  // required in that case; the others default the same way a variant's do.
  priceAmount?: string | undefined;
  priceCurrency?: string | undefined;
  compareAtAmount?: string | null | undefined;
  availableForSale?: boolean | undefined;
};

export async function createProduct(admin: AdminContext, input: CreateProductInput) {
  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.handle, input.handle)).limit(1);
  if (existing) throw new AppError(409, "HANDLE_TAKEN", `A product with handle "${input.handle}" already exists.`);

  // Resolved up front as plain, fully-typed values (not `input.hasVariants
  // ? ... : ...` inline in the insert) so TypeScript sees the simple-mode
  // branch's `priceAmount` as a definite `string`, not `string | undefined`.
  let priceAmount: string | null = null;
  let priceCurrency = "MAD";
  let compareAtAmount: string | null = null;
  let availableForSale = true;
  let stock: number | null = null;

  if (!input.hasVariants) {
    if (input.priceAmount === undefined) {
      throw AppError.badRequest("priceAmount is required to create a simple product (hasVariants: false).");
    }
    assertMoneyString("Price", input.priceAmount);
    if (input.compareAtAmount != null) {
      assertMoneyString("Compare-at price", input.compareAtAmount);
      assertCompareAtAbovePrice(input.priceAmount, input.compareAtAmount);
    }
    priceAmount = input.priceAmount;
    priceCurrency = input.priceCurrency ?? "MAD";
    compareAtAmount = input.compareAtAmount ?? null;
    availableForSale = input.availableForSale ?? true;
    // Stock always starts at 0 — even for a simple product — and is only
    // ever moved through the inventory endpoint (reusing adjustInventory
    // exactly as a variant's stock already does).
    stock = 0;
  }

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
        hasVariants: input.hasVariants,
        priceAmount,
        priceCurrency,
        compareAtAmount,
        availableForSale,
        stock,
      })
      .returning();
    if (!row) throw new Error("Product insert returned no row");

    // The Default Variant: a plain product_variants row that mirrors the
    // product's own commerce fields. It exists purely so cart/checkout/the
    // storefront mapper never need to know a simple product exists — see
    // services/admin/variants.ts's lockVariantManageableProduct for why it
    // can never be reached through the normal variant endpoints.
    if (!input.hasVariants) {
      await tx.insert(productVariants).values({
        productId: row.id,
        title: "Default",
        selectedOptions: [],
        priceAmount: row.priceAmount!,
        priceCurrency: row.priceCurrency,
        compareAtAmount: row.compareAtAmount,
        stock: 0,
        availableForSale: row.availableForSale,
        position: 0,
      });
    }

    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.create",
      entityType: "product",
      entityId: row.id,
      metadata: { handle: row.handle, title: row.title, status: row.status, hasVariants: row.hasVariants },
    });

    const variants = input.hasVariants
      ? []
      : await tx.select().from(productVariants).where(eq(productVariants.productId, row.id));
    return mapAdminProductDetail(row, [], [], variants);
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
  // Simple-product commerce (hasVariants: false only — rejected with 400
  // otherwise). `stock` is deliberately absent here, same discipline as a
  // variant's own update endpoint: it only ever moves through the
  // inventory endpoint (adjustProductInventory → adjustInventory).
  priceAmount?: string | undefined;
  priceCurrency?: string | undefined;
  compareAtAmount?: string | null | undefined;
  availableForSale?: boolean | undefined;
};

export async function updateProduct(admin: AdminContext, productId: string, input: UpdateProductInput) {
  return db.transaction(async (tx) => {
    // Locked for the whole update: serializes against a concurrent
    // switchProductMode (same lock) and against another concurrent
    // updateProduct, so two simultaneous PATCHes can never lose one's
    // change (§F of the spec — same discipline as adjustInventory).
    const [current] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!current) throw AppError.notFound("Product not found");

    const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    if (input.handle !== undefined && input.handle !== current.handle) {
      if (!HANDLE_RE.test(input.handle)) {
        throw AppError.badRequest("Handle must be lowercase letters, digits and single hyphens.");
      }
      const [taken] = await tx.select({ id: products.id }).from(products).where(eq(products.handle, input.handle)).limit(1);
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

    // ---- simple-product commerce fields (hasVariants: false only) ------
    const commerceFieldsProvided =
      input.priceAmount !== undefined ||
      input.priceCurrency !== undefined ||
      input.compareAtAmount !== undefined ||
      input.availableForSale !== undefined;
    if (commerceFieldsProvided && current.hasVariants) {
      throw AppError.badRequest(
        "Price, compare-at price, currency and availability can only be set on a simple product (hasVariants: false). Edit its variants instead.",
      );
    }
    if (input.priceAmount !== undefined && input.priceAmount !== current.priceAmount) {
      assertMoneyString("Price", input.priceAmount);
      patch.priceAmount = input.priceAmount;
      changed.priceAmount = { from: current.priceAmount, to: input.priceAmount };
    }
    if (input.priceCurrency !== undefined && input.priceCurrency !== current.priceCurrency) {
      patch.priceCurrency = input.priceCurrency;
      changed.priceCurrency = { from: current.priceCurrency, to: input.priceCurrency };
    }
    if (input.compareAtAmount !== undefined && input.compareAtAmount !== current.compareAtAmount) {
      if (input.compareAtAmount !== null) {
        assertMoneyString("Compare-at price", input.compareAtAmount);
        assertCompareAtAbovePrice(input.priceAmount ?? current.priceAmount ?? "0", input.compareAtAmount);
      }
      patch.compareAtAmount = input.compareAtAmount;
      changed.compareAtAmount = { from: current.compareAtAmount, to: input.compareAtAmount };
    }
    if (input.availableForSale !== undefined && input.availableForSale !== current.availableForSale) {
      patch.availableForSale = input.availableForSale;
      changed.availableForSale = { from: current.availableForSale, to: input.availableForSale };
    }

    if (Object.keys(changed).length === 0) {
      const [images, options, variants] = await Promise.all([
        tx.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position)),
        tx.select().from(productOptions).where(eq(productOptions.productId, productId)).orderBy(asc(productOptions.position)),
        tx.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.position)),
      ]);
      return mapAdminProductDetail(current, images, options, variants);
    }

    await tx.update(products).set(patch).where(eq(products.id, productId));

    // Keep the Default Variant in sync — it is the ONLY thing cart /
    // checkout / the storefront mapper ever read, so a simple product's
    // commerce edit must land there too, in the same transaction.
    const commerceChanged =
      "priceAmount" in changed || "priceCurrency" in changed || "compareAtAmount" in changed || "availableForSale" in changed;
    if (!current.hasVariants && commerceChanged) {
      await tx
        .update(productVariants)
        .set({
          priceAmount: patch.priceAmount ?? current.priceAmount ?? "0",
          priceCurrency: patch.priceCurrency ?? current.priceCurrency,
          compareAtAmount: "compareAtAmount" in patch ? (patch.compareAtAmount as string | null) : current.compareAtAmount,
          availableForSale: patch.availableForSale ?? current.availableForSale,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.productId, productId));
    }

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

// Same "genuinely active, non-expired cart" definition as
// services/admin/variants.ts's deleteVariant — the only cart state that
// can block a variants → simple switch (a shopper could still be checking
// out with that variant).
const activeCartCondition = () => and(eq(carts.status, "active"), gt(carts.expiresAt, new Date()));

// Flip a product between "with variants" and "simple", per the "variante
// implicite" spec. `product_variants` is NEVER DELETED by this function —
// only `products.has_variants` (+ its commerce columns) changes, except for
// the one case below where a Default Variant must first be CREATED (never
// removed) so the product always has exactly one variant once simple:
//   - variants → simple with exactly one variant: its values are copied
//     onto `products.*`.
//   - variants → simple with ZERO variants: a brand-new Default Variant is
//     inserted (title "Default", price "0.00" — product_variants.price is
//     NOT NULL — stock 0, available), because an admin must be able to
//     flip a freshly-created or never-priced product to simple without
//     first faking a throwaway variant through the normal variant UI. The
//     product's own `priceAmount` stays NULL ("not priced yet", same
//     signal createProduct already uses) — the admin fills it in via the
//     simple-product commerce form, which then syncs both (updateProduct).
//   - variants → simple with 2+ variants: refused (409 MULTIPLE_VARIANTS)
//     — the admin must resolve that explicitly, this never picks/merges
//     for them — and so is a variant held by a genuinely active cart.
//   - simple → variants: the Default Variant simply becomes an ordinary,
//     editable variant; `products.*` commerce columns are cleared back to
//     NULL since product_variants is once again the sole source of truth.
// Idempotent: switching to the mode the product is already in is a no-op
// (no write, no audit row).
export async function switchProductMode(admin: AdminContext, productId: string, mode: "simple" | "variants") {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!current) throw AppError.notFound("Product not found");

    const [images, options, variants] = await Promise.all([
      tx.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position)),
      tx.select().from(productOptions).where(eq(productOptions.productId, productId)).orderBy(asc(productOptions.position)),
      tx.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.position)),
    ]);

    if ((mode === "simple" && !current.hasVariants) || (mode === "variants" && current.hasVariants)) {
      return mapAdminProductDetail(current, images, options, variants);
    }

    let patch: Partial<typeof products.$inferInsert>;
    let auditMetadata: Record<string, unknown>;
    // Only populated in the "create a fresh Default Variant" sub-case, so
    // the final response reflects it without a redundant re-query.
    let finalVariants = variants;

    if (mode === "simple") {
      if (variants.length > 1) {
        throw AppError.conflict(
          "MULTIPLE_VARIANTS",
          "This product has more than one variant. Remove or merge the extra variants before switching it to simple.",
        );
      }

      if (variants.length === 0) {
        const [created] = await tx
          .insert(productVariants)
          .values({
            productId,
            title: "Default",
            selectedOptions: [],
            priceAmount: "0.00",
            priceCurrency: "MAD",
            compareAtAmount: null,
            stock: 0,
            availableForSale: true,
            position: 0,
          })
          .returning();
        if (!created) throw new Error("Default Variant insert returned no row");
        finalVariants = [created];

        patch = {
          hasVariants: false,
          // Stays NULL — "not priced yet" — until the admin sets it via
          // the simple-product commerce form (updateProduct then syncs
          // both this column and the Default Variant together).
          priceAmount: null,
          compareAtAmount: null,
          stock: 0,
          availableForSale: true,
          updatedAt: new Date(),
        };
        auditMetadata = { from: "variants", to: "simple", defaultVariantId: created.id, createdDefaultVariant: true };
      } else {
        const only = variants[0]!;

        const [activeInCart] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(cartLines)
          .innerJoin(carts, eq(cartLines.cartId, carts.id))
          .where(and(eq(cartLines.variantId, only.id), activeCartCondition()));
        if ((activeInCart?.count ?? 0) > 0) {
          throw AppError.conflict(
            "VARIANT_IN_CART",
            "This variant is in an active shopping cart and cannot be switched right now. Try again once that cart is no longer active.",
            { cartLineCount: activeInCart?.count ?? 0 },
          );
        }

        patch = {
          hasVariants: false,
          priceAmount: only.priceAmount,
          priceCurrency: only.priceCurrency,
          compareAtAmount: only.compareAtAmount,
          availableForSale: only.availableForSale,
          stock: only.stock,
          updatedAt: new Date(),
        };
        auditMetadata = { from: "variants", to: "simple", defaultVariantId: only.id };
      }
    } else {
      patch = {
        hasVariants: true,
        priceAmount: null,
        compareAtAmount: null,
        stock: null,
        updatedAt: new Date(),
      };
      auditMetadata = { from: "simple", to: "variants", defaultVariantId: variants[0]?.id ?? null };
    }

    await tx.update(products).set(patch).where(eq(products.id, productId));
    await recordAudit(tx, {
      adminUserId: admin.userId,
      action: "product.mode_switch",
      entityType: "product",
      entityId: productId,
      metadata: auditMetadata,
    });

    const [updated] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    // `product_variants` is only ever ADDED to above (the zero-variant
    // simple-switch sub-case) — `finalVariants` already reflects that;
    // every other branch leaves it exactly as read at the top, no re-query
    // needed either way.
    return mapAdminProductDetail(updated!, images, options, finalVariants);
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
