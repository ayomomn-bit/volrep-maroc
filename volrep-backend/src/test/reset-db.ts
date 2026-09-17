import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

// Test-only helper — truncates every domain table so each test file starts
// from a clean slate, and resets order_number_seq back to its documented
// starting value (1001) so assertions on order numbers stay deterministic.
export async function resetDb(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      reviews, review_media,
      order_line_items, orders, fulfillments, webhook_events,
      checkout_sessions, cart_lines, carts,
      product_content_blocks, product_landing_pages, product_pages,
      product_variants, product_images, product_options, products,
      homepage, site_media,
      admin_audit_log, admin_sessions, admin_users,
      shipping_settings, store_settings, email_outbox
    RESTART IDENTITY CASCADE
  `);
  await db.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1001`);
}
