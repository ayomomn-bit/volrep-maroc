-- Reshape product_landing_pages for the Lirya V1 integration (READ-ONLY).
-- The pre-Lirya columns (provider/external_id/name/slug/status/url) were
-- never written to; the table is a disposable cache, so it is truncated
-- and rebuilt with the Lirya binding + cache shape.
TRUNCATE TABLE "product_landing_pages";--> statement-breakpoint
ALTER TABLE "product_landing_pages" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "product_landing_pages" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "product_landing_pages" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "product_landing_pages" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "product_landing_pages" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "product_landing_pages" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "lirya_page_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "role" text DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "lirya_version" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_etag" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_status" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_public_url" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_slug" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_name" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_template" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_content_source" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "cached_external_ref_product_id" text;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD COLUMN "sync_error" text;--> statement-breakpoint
CREATE INDEX "product_landing_pages_lirya_page_id_idx" ON "product_landing_pages" USING btree ("lirya_page_id");--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD CONSTRAINT "product_landing_pages_product_role_unique" UNIQUE("product_id","role");--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD CONSTRAINT "product_landing_pages_product_page_unique" UNIQUE("product_id","lirya_page_id");
