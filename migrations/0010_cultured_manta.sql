ALTER TABLE "menu_items" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "clover_item_id" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "clover_category_id" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clover_merchant_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clover_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clover_connected_at" timestamp;