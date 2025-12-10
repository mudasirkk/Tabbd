-- Create stores table
CREATE TABLE "stores" (
  "id" varchar PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "avatar" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add store_id to menu_items
ALTER TABLE "menu_items" ADD COLUMN "store_id" varchar NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE;

-- Add store_id to square_tokens
ALTER TABLE "square_tokens" ADD COLUMN "store_id" varchar NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX "menu_items_store_id_idx" ON "menu_items"("store_id");
CREATE INDEX "square_tokens_store_id_idx" ON "square_tokens"("store_id");

