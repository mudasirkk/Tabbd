-- Backfill first
UPDATE "menu_items"
SET "category" = 'Miscellaneous'
WHERE "category" IS NULL OR btrim("category") = '';

-- Enforce NOT NULL
ALTER TABLE "menu_items"
ALTER COLUMN "category" SET NOT NULL;

-- Set DB-level default
ALTER TABLE "menu_items"
ALTER COLUMN "category" SET DEFAULT 'Miscellaneous';
