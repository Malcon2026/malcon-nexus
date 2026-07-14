-- Attendance punch in/out with geolocation
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS attendance_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name   TEXT NOT NULL DEFAULT '',
  punch_type      TEXT NOT NULL CHECK (punch_type IN ('in', 'out')),
  punched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  accuracy_m      DOUBLE PRECISION NOT NULL DEFAULT 0,
  distance_m      DOUBLE PRECISION NOT NULL DEFAULT 0,
  within_office   BOOLEAN NOT NULL DEFAULT FALSE,
  office_address  TEXT NOT NULL DEFAULT 'CCWW+RJ, Hyderabad, Telangana',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_punched_at ON attendance_records(punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_day ON attendance_records(employee_id, punched_at DESC);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_admin_all" ON attendance_records;
DROP POLICY IF EXISTS "attendance_employee_own" ON attendance_records;

CREATE POLICY "attendance_admin_all" ON attendance_records
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "attendance_employee_own" ON attendance_records
  FOR ALL USING (employee_id = current_employee_id())
  WITH CHECK (employee_id = current_employee_id());

COMMIT;
