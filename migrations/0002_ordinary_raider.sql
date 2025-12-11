ALTER TABLE "menu_items" ALTER COLUMN "store_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "square_tokens" ALTER COLUMN "store_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "store_sessions" ALTER COLUMN "store_id" DROP NOT NULL;