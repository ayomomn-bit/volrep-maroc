import { fileURLToPath } from "node:url";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db, closeDb } from "./client.js";
import { env } from "../config/env.js";
import {
  productImages,
  productOptions,
  productPages,
  productVariants,
  products,
  reviews,
} from "./schema/index.js";
import { DEFAULT_PAGE_DOCUMENT } from "../lib/product-page/defaults.js";

// ---------------------------------------------------------------------------
// VOLREP initial production-style catalog seed.
//
// The PostgreSQL database — not Shopify — is the storefront's source of
// truth from Phase 5 on. This module writes the one real product the
// storefront sells today so `GET /api/products` / `/api/products/:handle`
// have something to return.
//
// IDEMPOTENT: every row is reconciled against a stable natural key
// (product.handle, option.name, image.position, variant.title), so running
// `npm run db:seed` any number of times converges the catalog to exactly
// this state — never duplicate products / variants / images / options.
//
// Safe against the development database. Contains no secrets — it only
// reads DATABASE_URL (already validated by config/env.ts) to know where to
// write, and refuses to touch a production database without --force.
// ---------------------------------------------------------------------------

export const VOLREP_PRM_HANDLE = "volrep-prm";

// DEVELOPMENT / TEST INVENTORY ONLY — this is NOT real warehouse stock.
// It exists so add-to-cart, cart, COD checkout and the post-order stock
// decrement can be exercised end to end without a variant running dry
// mid-test. Real inventory is an admin-managed number that has to be
// supplied separately.
export const DEV_TEST_STOCK = 25;

type SeedImage = { url: string; altText: string; position: number };
type SeedVariant = {
  sku: string;
  title: string;
  selectedOptions: { name: string; value: string }[];
  priceAmount: string;
  priceCurrency: string;
  compareAtAmount: string;
  position: number;
  imageIndex: number;
};

// The approved VOLREP catalog content assembled from what already exists
// in the project — see the change report for provenance of each field.
export const volrepPrmSeed: {
  product: {
    handle: string;
    title: string;
    description: string;
    productType: string;
    tags: string[];
    status: "active";
  };
  option: { name: string; values: string[]; position: number };
  images: SeedImage[];
  variants: SeedVariant[];
} = {
  product: {
    handle: VOLREP_PRM_HANDLE,
    // The full product name as supplied for this phase. The retired
    // Shopify record carried the short form "Volrep PRM™"; the storefront
    // renders whatever this column holds, unchanged.
    title: "Volrep PRM™ Percussive Recovery Massager",
    // The only product description that exists anywhere in the project
    // (captured from an earlier backend response — see report).
    description:
      "Advanced 4D massage roller for full-body recovery. Hands-free, ergonomic, built for everyday use.",
    productType: "Recovery",
    tags: ["recovery", "best-seller"],
    status: "active",
  },
  option: { name: "Color", values: ["Black", "White"], position: 0 },
  // Real VOLREP product imagery hosted on the store's existing Shopify
  // file CDN (bucket 1/1010/7476/4088 — the same bucket the storefront's
  // own marketing sections already link directly, e.g.
  // components/home/RecoveryPhilosophy.tsx). These exact URLs were
  // recovered from the project's own captured product/catalog responses;
  // they are not invented.
  //
  // STORAGE STRATEGY: product_images.url holds an absolute URL. There is
  // no upload/asset pipeline in the backend yet. Migrating this imagery
  // onto Volrep-owned object storage and rewriting these URLs is a
  // separate, later task — flagged as outstanding in the report. For
  // local development these static URLs are fully deterministic.
  images: [
    {
      url: "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Resizing_VOLREP_product_logo_2K_202608101717.jpg?v=1786380748",
      altText: "Volrep PRM™ Percussive Recovery Massager",
      position: 0,
    },
    {
      url: "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Setting_background_color_for_pro__202608102102-Photoroom.png?v=1786392802",
      altText: "Volrep PRM™ Percussive Recovery Massager",
      position: 1,
    },
  ],
  // Approved VOLREP pricing from the project: 899.00 MAD, compare-at
  // 1099.00 MAD — a genuine 200.00 MAD (~18%) discount. Currency MAD,
  // matching every other money column default in the schema. The backend
  // stays authoritative for all money math (src/services/checkout.ts);
  // these are only the per-variant list/compare prices it computes from.
  variants: [
    {
      sku: "VOLREP-PRM-BLK",
      title: "Black",
      selectedOptions: [{ name: "Color", value: "Black" }],
      priceAmount: "899.00",
      priceCurrency: "MAD",
      compareAtAmount: "1099.00",
      position: 0,
      imageIndex: 0,
    },
    {
      sku: "VOLREP-PRM-WHT",
      title: "White",
      selectedOptions: [{ name: "Color", value: "White" }],
      priceAmount: "899.00",
      priceCurrency: "MAD",
      compareAtAmount: "1099.00",
      position: 1,
      imageIndex: 1,
    },
  ],
};

export type SeedResult = {
  productId: string;
  created: boolean;
  variantIdsByTitle: Record<string, string>;
  imageIds: string[];
  removedFabricatedReviews: number;
};

// Runs the whole reconcile in one transaction so a partial failure leaves
// the catalog untouched.
export async function seedCatalog(options: { log?: boolean } = {}): Promise<SeedResult> {
  const log = options.log ? (msg: string) => console.log(`  ${msg}`) : () => {};

  return db.transaction(async (tx) => {
    // 1. Product — natural key: handle (unique).
    const [priorProduct] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.handle, VOLREP_PRM_HANDLE))
      .limit(1);

    const [product] = await tx
      .insert(products)
      .values({ ...volrepPrmSeed.product })
      .onConflictDoUpdate({
        target: products.handle,
        set: {
          title: volrepPrmSeed.product.title,
          description: volrepPrmSeed.product.description,
          productType: volrepPrmSeed.product.productType,
          tags: volrepPrmSeed.product.tags,
          status: volrepPrmSeed.product.status,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!product) throw new Error("seed: product upsert returned no row");
    const created = !priorProduct;
    log(created ? "product: created" : "product: updated in place");

    // 2. Option — natural key: (product_id, name) (unique).
    await tx
      .insert(productOptions)
      .values({ productId: product.id, ...volrepPrmSeed.option })
      .onConflictDoUpdate({
        target: [productOptions.productId, productOptions.name],
        set: { values: volrepPrmSeed.option.values, position: volrepPrmSeed.option.position },
      });
    log("option: Color [Black, White]");

    // 3. Images — natural key: (product_id, position). Update the row at
    //    each position in place (so an earlier placeholder URL converges
    //    to the real one), insert any missing position, then drop any
    //    image beyond the positions this seed defines.
    const existingImages = await tx
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    const imageByPosition = new Map(existingImages.map((image) => [image.position, image]));

    const imageIds: string[] = [];
    for (const image of volrepPrmSeed.images) {
      const found = imageByPosition.get(image.position);
      if (found) {
        // Once an image has been migrated to Volrep-owned storage
        // (storage_key set, Phase 7C-2) the seed must NOT clobber its URL
        // back to the Shopify CDN — only keep the alt text in sync.
        await tx
          .update(productImages)
          .set(found.storageKey ? { altText: image.altText } : { url: image.url, altText: image.altText })
          .where(eq(productImages.id, found.id));
        imageIds.push(found.id);
      } else {
        const [inserted] = await tx
          .insert(productImages)
          .values({ productId: product.id, url: image.url, altText: image.altText, position: image.position })
          .returning();
        if (!inserted) throw new Error("seed: image insert returned no row");
        imageIds.push(inserted.id);
      }
    }
    // Any variant pointing at one of these is FK ON DELETE SET NULL; the
    // variant reconcile below re-points it immediately.
    if (imageIds.length > 0) {
      await tx
        .delete(productImages)
        .where(and(eq(productImages.productId, product.id), notInArray(productImages.id, imageIds)));
    }
    log(`images: ${imageIds.length}`);

    // 4. Variants — natural key: (product_id, title). Matched this way
    //    rather than by SKU so a pre-existing SKU-less row (e.g. a manual
    //    dev insert) is updated in place and gains its SKU, instead of a
    //    duplicate being created. Existing rows are never deleted here —
    //    cart_lines references them ON DELETE RESTRICT.
    const existingVariants = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id));
    const variantByTitle = new Map(existingVariants.map((variant) => [variant.title, variant]));

    const variantIdsByTitle: Record<string, string> = {};
    for (const variant of volrepPrmSeed.variants) {
      const imageId = imageIds[variant.imageIndex] ?? null;
      const shared = {
        productId: product.id,
        sku: variant.sku,
        selectedOptions: variant.selectedOptions,
        priceAmount: variant.priceAmount,
        priceCurrency: variant.priceCurrency,
        compareAtAmount: variant.compareAtAmount,
        availableForSale: true,
        imageId,
        position: variant.position,
      };
      const found = variantByTitle.get(variant.title);
      if (found) {
        await tx
          .update(productVariants)
          .set({ ...shared, stock: DEV_TEST_STOCK, updatedAt: new Date() })
          .where(eq(productVariants.id, found.id));
        variantIdsByTitle[variant.title] = found.id;
      } else {
        const [inserted] = await tx
          .insert(productVariants)
          .values({ ...shared, title: variant.title, stock: DEV_TEST_STOCK })
          .returning();
        if (!inserted) throw new Error(`seed: variant insert returned no row (${variant.title})`);
        variantIdsByTitle[variant.title] = inserted.id;
      }
    }
    log(`variants: ${Object.keys(variantIdsByTitle).join(", ")} @ dev/test stock ${DEV_TEST_STOCK}`);

    // 5. Reviews — the project has no legitimate, provenance-clear review
    //    records to migrate, so reviews stay genuinely empty (Architecture
    //    §09; this phase's brief: "Do NOT seed fabricated customer
    //    reviews"). Any review already attached to this product with no
    //    backing order is dev / manual-test noise and is removed so the
    //    storefront honestly shows zero reviews. review_media rows cascade.
    const removed = await tx
      .delete(reviews)
      .where(and(eq(reviews.productId, product.id), isNull(reviews.orderId)))
      .returning({ id: reviews.id });
    if (removed.length > 0) log(`reviews: removed ${removed.length} fabricated (order-less) row(s)`);

    // 6. Product Studio "Page produit" — natural key: product_id (PK).
    //    Seed the editable landing-page document from DEFAULT_PAGE_DOCUMENT
    //    (a 1:1 transcription of today's live page). INSERT ... DO NOTHING:
    //    an existing row is NEVER touched, so admin draft edits and a
    //    published document both survive re-seeding untouched.
    const pageInsert = await tx
      .insert(productPages)
      .values({
        productId: product.id,
        draft: DEFAULT_PAGE_DOCUMENT,
        published: DEFAULT_PAGE_DOCUMENT,
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ productId: productPages.productId });
    log(
      pageInsert.length > 0
        ? "product page: seeded default document (draft + published)"
        : "product page: existing row left untouched",
    );

    // Product Studio hero + content-block demo data was removed here when
    // that editing surface moved to Lirya (STEP 2 backend trim). The
    // `hero_*` columns and `product_content_blocks` table still exist in
    // the DB but nothing seeds or reads them any more.

    return {
      productId: product.id,
      created,
      variantIdsByTitle,
      imageIds,
      removedFabricatedReviews: removed.length,
    };
  });
}

function redactedDbTarget(): string {
  try {
    const url = new URL(env.DATABASE_URL);
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function runCli(): Promise<void> {
  const force = process.argv.includes("--force");
  if (env.NODE_ENV === "production" && !force) {
    console.error("Refusing to seed with NODE_ENV=production. Re-run with --force if this is intentional.");
    process.exit(1);
  }

  console.log(`Seeding VOLREP catalog → ${redactedDbTarget()}`);
  const result = await seedCatalog({ log: true });
  console.log(
    result.created
      ? `Done. Created product ${result.productId}.`
      : `Done. Product ${result.productId} already existed and was reconciled.`,
  );
  await closeDb();
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runCli().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
