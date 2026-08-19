-- Planned From place on location punchin. To stays in hospital_* columns.

BEGIN;

ALTER TABLE location_trips
  ADD COLUMN IF NOT EXISTS from_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS from_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS from_eloc TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS from_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS from_lng DOUBLE PRECISION;

COMMIT;
