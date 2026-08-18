-- Maps two-wheeler card: km + minutes (like Google Maps 13 km · 32 min).

BEGIN;

ALTER TABLE location_trips
  ADD COLUMN IF NOT EXISTS bike_km NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS bike_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS bike_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bike_mode TEXT NOT NULL DEFAULT '';

COMMIT;
