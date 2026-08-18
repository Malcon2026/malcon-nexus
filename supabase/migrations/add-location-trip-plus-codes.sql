-- Plus Codes (Google Open Location Codes) on start/end punches for Maps re-check.
-- Safe to run after add-location-trips.sql.

BEGIN;

ALTER TABLE location_trips
  ADD COLUMN IF NOT EXISTS start_plus_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_plus_code TEXT NOT NULL DEFAULT '';

COMMIT;
