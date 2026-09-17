import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { contentBlockType, productStatus } from "./enums.js";

// A single product benefit — a titled paragraph. Kept structured (not one
// HTML blob) so Product Studio (7C-3) can arrange these as content blocks.
export type ProductBenefit = { title: string; body: string };

// `product_content_blocks.data` — the per-type structured JSON. Its exact
// shape is validated per block type at the service layer (zod discriminated
// union), never in the DB. Stored as an opaque object here.
export type ContentBlockData = Record<string, unknown>;

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: text("handle").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // Feeds ShopifyProductSummary.productType / .tags in the frontend
    // migration contract — needed for BestSellers/ProductCarousel.
    productType: text("product_type").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: productStatus("status").notNull().default("draft"),
    // ---- Structured product content (Phase 7C-2) ---------------------
    // Additive: the storefront API mappers do not read these yet, so the
    // public product contract is unchanged. Product Studio (7C-3) composes
    // these into hero/marketing sections.
    // Short punchy tagline / accroche shown under the title.
    subtitle: text("subtitle").notNull().default(""),
    // Free marketing paragraph(s) specific to this product.
    marketingCopy: text("marketing_copy").notNull().default(""),
    // [{ title, body }] — titled benefit paragraphs.
    benefits: jsonb("benefits").notNull().$type<ProductBenefit[]>().default(sql`'[]'::jsonb`),
    // Short bullet strings — the "key selling points".
    sellingPoints: jsonb("selling_points").notNull().$type<string[]>().default(sql`'[]'::jsonb`),
    // SEO overrides; empty string means "fall back to title / description".
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    // ---- Product Studio hero (Phase 7C-3) ---------------------------
    // The product page's top presentation block. Additive: the storefront
    // API mappers do not read these yet, so the public product contract is
    // unchanged. Hero media point at rows in product_images; kept as plain
    // uuids (not FKs) to avoid a circular table reference — the studio
    // service validates the id belongs to the product on write and nulls a
    // stale reference on image delete, and the mapper resolves defensively.
    heroEnabled: boolean("hero_enabled").notNull().default(true),
    heroHeadline: text("hero_headline").notNull().default(""),
    heroSubtitle: text("hero_subtitle").notNull().default(""),
    heroBody: text("hero_body").notNull().default(""),
    heroCtaLabel: text("hero_cta_label").notNull().default(""),
    heroCtaUrl: text("hero_cta_url").notNull().default(""),
    heroPrimaryImageId: uuid("hero_primary_image_id"),
    heroSecondaryImageId: uuid("hero_secondary_image_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    handleUnique: unique("products_handle_unique").on(table.handle),
    statusIdx: index("products_status_idx").on(table.status),
  }),
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    // ---- Volrep-owned media metadata (Phase 7C-2) -------------------
    // NULL storageKey ⇒ a legacy/external URL (e.g. cdn.shopify.com) that
    // predates the upload pipeline. NON-NULL ⇒ an image uploaded through
    // POST /api/admin/products/:id/media and stored on Volrep storage.
    // This is the ONLY signal that media is "owned"; an admin can never
    // promote an arbitrary URL to owned status.
    storageKey: text("storage_key"),
    contentType: text("content_type"),
    // sha256 hex of the stored bytes — filenames are content-addressed.
    checksum: text("checksum"),
    byteSize: integer("byte_size"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productPositionIdx: index("product_images_product_id_position_idx").on(table.productId, table.position),
  }),
);

export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // e.g. "Color". No separate product_option_values table — `values` is a
    // plain array, matching ShopifyProductOption { name, values: string[] }
    // exactly. A child table would be an entity the frontend shape doesn't
    // ask for (Architecture §03).
    name: text("name").notNull(),
    values: text("values").array().notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => ({
    productNameUnique: unique("product_options_product_id_name_unique").on(table.productId, table.name),
  }),
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku"),
    title: text("title").notNull(),
    // [{ name, value }] — mirrors ShopifySelectedOption[].
    selectedOptions: jsonb("selected_options").notNull().$type<{ name: string; value: string }[]>(),
    priceAmount: numeric("price_amount", { precision: 10, scale: 2 }).notNull(),
    priceCurrency: text("price_currency").notNull().default("MAD"),
    compareAtAmount: numeric("compare_at_amount", { precision: 10, scale: 2 }),
    stock: integer("stock").notNull().default(0),
    // Manual override independent of stock (e.g. preorder) — matches
    // Architecture §03.
    availableForSale: boolean("available_for_sale").notNull().default(true),
    imageId: uuid("image_id").references(() => productImages.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("product_variants_product_id_idx").on(table.productId),
    skuUnique: unique("product_variants_sku_unique").on(table.sku),
    stockNonNegative: check("product_variants_stock_check", sql`${table.stock} >= 0`),
  }),
);

// ---- Product Studio content blocks (Phase 7C-3) ---------------------
//
// A product's marketing page is composed from an ordered list of typed,
// individually toggleable content blocks — NOT one HTML/JSON blob. Each
// row carries its own stable id, a `type` from the content_block_type
// enum, a `position` (0-based, compacted on delete), an `enabled` flag
// and a `data` JSON payload whose shape is validated per-type at the
// service layer. Adding a new block type never touches this table.
export const productContentBlocks = pgTable(
  "product_content_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: contentBlockType("type").notNull(),
    position: integer("position").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    data: jsonb("data").notNull().$type<ContentBlockData>().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productPositionIdx: index("product_content_blocks_product_id_position_idx").on(table.productId, table.position),
  }),
);

// ---- Product ↔ Lirya landing page (V1 integration, READ-ONLY) -------
//
// Volrep owns the Product and the Product ↔ Landing Page binding; Lirya
// owns the page itself (content, HTML, URL, publish state). This table
// stores ONLY the binding (`liryaPageId`, `role`) plus a DISPOSABLE cache
// of a few display fields — never HTML, structured content, lp_config or
// rendered markup. The cache is fully rebuildable from GET /api/v1/pages/
// {id}. Volrep never writes to Lirya in V1.
//
// `liryaPageId` is the stable `pg_*` identifier. `role` is free text
// (default 'primary'); UNIQUE(product_id, role) means a product can hold
// at most one page per role — in particular one primary. The V1 admin UI
// only ever binds as 'primary'; the column leaves room for more roles
// later without a migration.
export const productLandingPages = pgTable(
  "product_landing_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Stable Lirya identity — `pg_*`.
    liryaPageId: text("lirya_page_id").notNull(),
    role: text("role").notNull().default("primary"),
    // ---- disposable cache (rebuildable from Lirya) -------------------
    // Lirya's opaque version marker + HTTP ETag, used for If-None-Match.
    liryaVersion: text("lirya_version"),
    cachedEtag: text("cached_etag"),
    // Raw Lirya status: 'published' | 'hidden' | 'draft'. Mapped to
    // French in the admin UI, not here.
    cachedStatus: text("cached_status"),
    cachedPublicUrl: text("cached_public_url"),
    cachedSlug: text("cached_slug"),
    cachedName: text("cached_name"),
    cachedTemplate: text("cached_template"),
    // Lirya's content_source (e.g. 'legacy' vs a structured/API draft) —
    // gates whether the legacy "Modifier dans Lirya" editor link is shown.
    cachedContentSource: text("cached_content_source"),
    // page.external_ref.product_id as reported by Lirya. A reference (not
    // content); compared against this row's product_id for the integrity
    // check. NULL when Lirya reports no external_ref.
    cachedExternalRefProductId: text("cached_external_ref_product_id"),
    // Last successful 200 from Lirya.
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    // Last check attempt of any kind (200 / 304 / failure).
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    // NULL when the last check succeeded, otherwise a stable code:
    // 'page_not_found' | 'unauthorized' | 'insufficient_scope' |
    // 'rate_limited' | 'unavailable'. The binding is NEVER deleted just
    // because a check failed.
    syncError: text("sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("product_landing_pages_product_id_idx").on(table.productId),
    liryaPageIdx: index("product_landing_pages_lirya_page_id_idx").on(table.liryaPageId),
    productRoleUnique: unique("product_landing_pages_product_role_unique").on(table.productId, table.role),
    productPageUnique: unique("product_landing_pages_product_page_unique").on(table.productId, table.liryaPageId),
  }),
);
