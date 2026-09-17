CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL,
	"store_name" text DEFAULT 'VOLREP' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"support_email" text DEFAULT '' NOT NULL,
	"social_instagram" text DEFAULT '' NOT NULL,
	"social_tiktok" text DEFAULT '' NOT NULL,
	"social_youtube" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "store_settings_singleton" CHECK ("store_settings"."id" = '00000000-0000-0000-0000-000000000001')
);
--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;