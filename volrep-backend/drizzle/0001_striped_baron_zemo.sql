ALTER TABLE "product_images" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "checksum" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "byte_size" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "subtitle" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "marketing_copy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "benefits" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "selling_points" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_description" text DEFAULT '' NOT NULL;