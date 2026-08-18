-- Location punchin: start GPS → reached GPS → distance as Trip 1, Trip 2, …
-- Notes required. Not tied to attendance or petrol. Run in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS location_trips (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name      TEXT NOT NULL DEFAULT '',
  trip_no            INTEGER NOT NULL,
  notes              TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'started'
                       CHECK (status IN ('started', 'completed')),
  start_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  start_lat          DOUBLE PRECISION NOT NULL,
  start_lng          DOUBLE PRECISION NOT NULL,
  start_accuracy_m   DOUBLE PRECISION NOT NULL DEFAULT 0,
  start_plus_code    TEXT NOT NULL DEFAULT '',
  end_at             TIMESTAMPTZ,
  end_lat            DOUBLE PRECISION,
  end_lng            DOUBLE PRECISION,
  end_accuracy_m     DOUBLE PRECISION,
  end_plus_code      TEXT NOT NULL DEFAULT '',
  distance_km        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bike_km            NUMERIC(10, 2),
  bike_minutes       INTEGER,
  bike_source        TEXT NOT NULL DEFAULT '',
  bike_mode          TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_trips_employee_id ON location_trips(employee_id);
CREATE INDEX IF NOT EXISTS idx_location_trips_start_at ON location_trips(start_at DESC);

-- One open trip at a time per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_trips_one_open
  ON location_trips (employee_id)
  WHERE status = 'started';

ALTER TABLE location_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_trip_admin_all" ON location_trips;
DROP POLICY IF EXISTS "location_trip_employee_select" ON location_trips;
DROP POLICY IF EXISTS "location_trip_employee_insert" ON location_trips;
DROP POLICY IF EXISTS "location_trip_employee_complete" ON location_trips;

CREATE POLICY "location_trip_admin_all" ON location_trips
  FOR ALL USING (current_user_role() IN ('admin', 'petrol'));

CREATE POLICY "location_trip_employee_select" ON location_trips
  FOR SELECT USING (employee_id = current_employee_id());

CREATE POLICY "location_trip_employee_insert" ON location_trips
  FOR INSERT WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'started'
  );

CREATE POLICY "location_trip_employee_complete" ON location_trips
  FOR UPDATE USING (
    employee_id = current_employee_id()
    AND status = 'started'
  )
  WITH CHECK (
    employee_id = current_employee_id()
    AND status IN ('started', 'completed')
  );

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_location_trips ON location_trips;
CREATE TRIGGER set_updated_at_location_trips
  BEFORE UPDATE ON location_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
