-- Destination hospital picked from Mappls / Malcon list on location punchin.

BEGIN;

ALTER TABLE location_trips
  ADD COLUMN IF NOT EXISTS hospital_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hospital_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hospital_eloc TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hospital_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hospital_lng DOUBLE PRECISION;

COMMIT;
