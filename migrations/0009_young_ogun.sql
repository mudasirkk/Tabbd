ALTER TABLE "menu_items" ADD COLUMN "is_variable_price" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "customer_name" text;