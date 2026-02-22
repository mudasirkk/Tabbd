ALTER TABLE "stations" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

WITH ranked AS (
  SELECT
    id,
    user_id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, created_at DESC, id ASC
    ) - 1 AS rn
  FROM stations
)
UPDATE stations st
SET sort_order = ranked.rn
FROM ranked
WHERE st.id = ranked.id;--> statement-breakpoint

CREATE INDEX "stations_user_sort_order_idx" ON "stations" USING btree ("user_id","sort_order");
