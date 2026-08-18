-- Bike (two-wheeler) road km from Google Maps or Mappls, between start and reached punches.

BEGIN;

ALTER TABLE location_trips
  ADD COLUMN IF NOT EXISTS bike_km NUMERIC(10, 2);

COMMIT;
