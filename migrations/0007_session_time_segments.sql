CREATE TABLE IF NOT EXISTS "session_time_segments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" varchar NOT NULL REFERENCES "sessions"("id") ON DELETE cascade,
  "sequence" integer NOT NULL,
  "station_id" varchar NOT NULL REFERENCES "stations"("id") ON DELETE cascade,
  "station_name_snapshot" text NOT NULL,
  "station_type_snapshot" text NOT NULL,
  "started_at" timestamp NOT NULL,
  "ended_at" timestamp NOT NULL,
  "effective_seconds" integer NOT NULL,
  "pricing_tier" "pricing_tier" NOT NULL,
  "rate_solo_hourly_snapshot" numeric(10, 2) NOT NULL,
  "rate_group_hourly_snapshot" numeric(10, 2) NOT NULL,
  "rate_hourly_applied" numeric(10, 2) NOT NULL,
  "time_amount" numeric(10, 2) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "session_time_segments_session_id_idx"
  ON "session_time_segments" ("session_id");

CREATE INDEX IF NOT EXISTS "session_time_segments_session_sequence_idx"
  ON "session_time_segments" ("session_id", "sequence");
