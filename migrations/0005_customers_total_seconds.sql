-- Rename total_hours to total_seconds for loyalty flow (all seconds-based)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'total_hours'
  ) THEN
    ALTER TABLE "customers" RENAME COLUMN "total_hours" TO "total_seconds";
  END IF;
END $$;
