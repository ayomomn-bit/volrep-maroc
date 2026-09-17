import { sql } from "drizzle-orm";
import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin.js";
import { products } from "./catalog.js";

// ---- Product Studio "Page produit" — the editable long-form landing page --
//
// ONE row per product. The whole customer-facing product page is a single
// JSON document — an ordered list of typed, individually toggleable
// sections plus page-level settings — NOT a table of section rows. This is
// the pragmatic model the brief asks for ("prefer structured JSON/typed
// fields; do not create an unnecessarily complex CMS").
//
// Draft / publish is two columns:
//   - editing in Product Studio mutates `draft`
//   - "Publier" copies `draft` into `published` (+ stamps `published_at`)
//   - the storefront reads `published`; when it is NULL the storefront
//     falls back to the code-owned default document
//     (src/lib/product-page/defaults.ts), so a product that has never been
//     published still renders exactly today's page.
//
// The per-section payload shapes are validated per-type by zod at the
// service layer (src/lib/product-page/schema.ts), never in the database —
// same rule the retired 7C-3 content-blocks model followed. `draft` is
// NOT NULL (a get-or-create seeds it from the default document);
// `published` is nullable ("never published yet").
export const productPages = pgTable("product_pages", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  draft: jsonb("draft").notNull().$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
  published: jsonb("published").$type<Record<string, unknown>>(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
});
