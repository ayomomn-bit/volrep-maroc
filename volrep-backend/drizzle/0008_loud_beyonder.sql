ALTER TABLE "products" ADD COLUMN "has_variants" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_currency" text DEFAULT 'MAD' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "compare_at_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "available_for_sale" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_check" CHECK ("products"."stock" is null or "products"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_compare_at_check" CHECK ("products"."compare_at_amount" is null or "products"."price_amount" is null or "products"."compare_at_amount" > "products"."price_amount");