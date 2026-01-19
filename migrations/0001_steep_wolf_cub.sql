-- 1) Add new columns first (rate snapshot + total)
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "rate_hourly_snapshot" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "total_amount" numeric(10,2);

-- 2) Backfill pricing_tier for existing rows
UPDATE "sessions"
SET "pricing_tier" = 'solo'
WHERE "pricing_tier" IS NULL;

-- 3) Backfill snapshot for existing rows (legacy sessions)
UPDATE "sessions"
SET "rate_hourly_snapshot" = 0
WHERE "rate_hourly_snapshot" IS NULL;

-- 4) Enforce NOT NULL constraints
ALTER TABLE "sessions"
  ALTER COLUMN "pricing_tier" SET NOT NULL;

ALTER TABLE "sessions"
  ALTER COLUMN "rate_hourly_snapshot" SET NOT NULL;
