-- category already exists in some environments; make this safe
ALTER TABLE "menu_items"
ADD COLUMN IF NOT EXISTS "category" text;

-- Normalize existing data (also converts Uncategorized -> Miscellaneous)
UPDATE "menu_items"
SET "category" = 'Miscellaneous'
WHERE "category" IS NULL OR btrim("category") = '' OR "category" = 'Uncategorized';

-- Enforce required + default
ALTER TABLE "menu_items"
ALTER COLUMN "category" SET DEFAULT 'Miscellaneous';

ALTER TABLE "menu_items"
ALTER COLUMN "category" SET NOT NULL;
