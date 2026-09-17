import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin.js";

// The store identity Volrep owns as source of truth: wordmark, tagline,
// support email and the three social links. This is store-level config,
// NOT a CMS — navigation menus, footer columns and the brand logo stay
// code-owned in the storefront (`volrep-maroc` lib/site/*) for now.
//
// Single-row table: the row id is pinned to STORE_SETTINGS_ID by a CHECK
// constraint, so there is exactly one settings record and the admin audit
// log (entity_id is a uuid) has a stable target to reference. The service
// layer does a get-or-create against that fixed id.
//
// NO SECRET belongs here — integration credentials (Lirya API key, …) stay
// in server-side environment variables and never touch the database.
export const STORE_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export const storeSettings = pgTable(
  "store_settings",
  {
    id: uuid("id").primaryKey().default(STORE_SETTINGS_ID),
    storeName: text("store_name").notNull().default("VOLREP"),
    tagline: text("tagline").notNull().default(""),
    supportEmail: text("support_email").notNull().default(""),
    socialInstagram: text("social_instagram").notNull().default(""),
    socialTiktok: text("social_tiktok").notNull().default(""),
    socialYoutube: text("social_youtube").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  },
  (table) => ({
    singleton: check("store_settings_singleton", sql`${table.id} = '${sql.raw(STORE_SETTINGS_ID)}'`),
  }),
);
