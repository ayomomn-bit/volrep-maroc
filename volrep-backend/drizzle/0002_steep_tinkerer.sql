CREATE TYPE "public"."content_block_type" AS ENUM('benefits', 'selling_points', 'text_media', 'image_text', 'feature_highlights');--> statement-breakpoint
CREATE TABLE "product_content_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "content_block_type" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"name" text DEFAULT '' NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'unlinked' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_headline" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_subtitle" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_cta_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_cta_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_primary_image_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_secondary_image_id" uuid;--> statement-breakpoint
ALTER TABLE "product_content_blocks" ADD CONSTRAINT "product_content_blocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_landing_pages" ADD CONSTRAINT "product_landing_pages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_content_blocks_product_id_position_idx" ON "product_content_blocks" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_landing_pages_product_id_idx" ON "product_landing_pages" USING btree ("product_id");