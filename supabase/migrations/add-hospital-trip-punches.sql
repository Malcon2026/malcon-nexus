-- Optional pilot: office → hospital GPS punch. Distance is calculated on each punch.
-- Not required for attendance or petrol. Run in Supabase Dashboard → SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS hospital_trip_punches (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name    TEXT NOT NULL DEFAULT '',
  hospital_id      UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  hospital_name    TEXT NOT NULL DEFAULT '',
  punched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude         DOUBLE PRECISION NOT NULL,
  longitude        DOUBLE PRECISION NOT NULL,
  accuracy_m       DOUBLE PRECISION NOT NULL DEFAULT 0,
  from_latitude    DOUBLE PRECISION,
  from_longitude   DOUBLE PRECISION,
  from_label       TEXT NOT NULL DEFAULT '',
  distance_km      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospital_trip_employee_id ON hospital_trip_punches(employee_id);
CREATE INDEX IF NOT EXISTS idx_hospital_trip_punched_at ON hospital_trip_punches(punched_at DESC);

ALTER TABLE hospital_trip_punches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospital_trip_admin_all" ON hospital_trip_punches;
DROP POLICY IF EXISTS "hospital_trip_employee_own" ON hospital_trip_punches;

CREATE POLICY "hospital_trip_admin_all" ON hospital_trip_punches
  FOR ALL USING (current_user_role() IN ('admin', 'petrol'));

CREATE POLICY "hospital_trip_employee_select" ON hospital_trip_punches
  FOR SELECT USING (employee_id = current_employee_id());

CREATE POLICY "hospital_trip_employee_insert" ON hospital_trip_punches
  FOR INSERT WITH CHECK (employee_id = current_employee_id());

COMMIT;
