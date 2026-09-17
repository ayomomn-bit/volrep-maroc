import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin.js";

// ---- Homepage Studio — the editable storefront homepage --------------------
//
// ONE row. The whole customer-facing homepage ("/") is a single JSON
// document — an ordered list of typed, individually toggleable sections plus
// page-level settings — NOT a table of section rows. Same pragmatic model as
// Product Studio's `product_pages` (see src/db/schema/product-page.ts).
//
// Draft / publish is two columns:
//   - editing in Homepage Studio mutates `draft`
//   - "Publier" copies `draft` into `published` (+ stamps `published_at`)
//   - the storefront reads `published`; when it is NULL it falls back to the
//     code-owned default document (src/lib/homepage/defaults.ts), a 1:1
//     transcription of today's hardcoded homepage — so nothing has to change
//     visually until an editor publishes.
//
// The per-section payload shapes are validated per-type by zod at the service
// layer (src/lib/homepage/schema.ts), never in the database. `draft` is
// NOT NULL (a get-or-create seeds it from the default document); `published`
// is nullable ("never published yet").
//
// Single-row table: the id is pinned to HOMEPAGE_ID by a CHECK constraint,
// exactly like `store_settings`, so the admin audit log (entity_id is a
// uuid) has a stable target and the service does a get-or-create against
// that fixed id.
export const HOMEPAGE_ID = "00000000-0000-0000-0000-000000000002";

export const homepage = pgTable(
  "homepage",
  {
    id: uuid("id").primaryKey().default(HOMEPAGE_ID),
    draft: jsonb("draft").notNull().$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    published: jsonb("published").$type<Record<string, unknown>>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  },
  (table) => ({
    singleton: check("homepage_singleton", sql`${table.id} = '${sql.raw(HOMEPAGE_ID)}'`),
  }),
);

// ---- Site media — homepage / site-level assets ---------------------------
//
// A product-INDEPENDENT asset store. This table has NO product_id and NO
// relationship to `product_images`: a Homepage Studio upload must never
// appear in a product's gallery, and a product gallery image is never a
// valid site-media reference. The two stores share only the low-level
// storage adapter (src/lib/media-storage) and the content-addressed key
// scheme — files land under `site/<sha256>.<ext>`, never `products/`.
//
// Homepage media slots (src/lib/homepage/schema.ts `homepageMediaSlotSchema`)
// reference a row here by id when `kind === "image"`; `kind === "url"` slots
// hold an arbitrary http(s) URL and touch no table at all.
export const siteMedia = pgTable("site_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Public, fetchable URL of the stored object (media storage's publicUrl for
  // the key). Stored like product_images.url so readers don't need the
  // storage adapter.
  url: text("url").notNull(),
  // Content-addressed object key on media storage: `site/<sha256>.<ext>`.
  storageKey: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  // sha256 hex of the stored bytes — the dedupe key.
  checksum: text("checksum").notNull(),
  byteSize: integer("byte_size").notNull(),
  // Header-declared dimensions when the media system can read them (raster
  // images / GIF); NULL for video and for headers we can't parse.
  width: integer("width"),
  height: integer("height"),
  // "image" | "gif" | "video" — how a slot filled with this asset renders.
  // Plain text (not an enum) to match the storefront-side MediaSlot union
  // and stay addable without a migration, same rationale as
  // checkout_sessions.provider.
  mediaType: text("media_type").notNull().default("image"),
  // Original upload filename, display-only in the Studio. Never used to
  // fetch anything.
  originalFilename: text("original_filename").notNull().default(""),
  altText: text("alt_text").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
});
