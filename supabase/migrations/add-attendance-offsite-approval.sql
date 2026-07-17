-- Off-site punch-out requests requiring admin approval
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS attendance_approval_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name         TEXT NOT NULL DEFAULT '',
  punch_type            TEXT NOT NULL DEFAULT 'out' CHECK (punch_type IN ('out')),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude              DOUBLE PRECISION NOT NULL,
  longitude             DOUBLE PRECISION NOT NULL,
  accuracy_m            DOUBLE PRECISION NOT NULL DEFAULT 0,
  distance_m            DOUBLE PRECISION NOT NULL DEFAULT 0,
  reason                TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by           TEXT,
  reviewed_by_id        UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  admin_notes           TEXT NOT NULL DEFAULT '',
  attendance_record_id  UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_approval_employee_id
  ON attendance_approval_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_approval_status
  ON attendance_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_attendance_approval_requested_at
  ON attendance_approval_requests(requested_at DESC);

ALTER TABLE attendance_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_approval_admin_all" ON attendance_approval_requests;
DROP POLICY IF EXISTS "attendance_approval_employee_own" ON attendance_approval_requests;

CREATE POLICY "attendance_approval_admin_all" ON attendance_approval_requests
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "attendance_approval_employee_own" ON attendance_approval_requests
  FOR SELECT USING (employee_id = current_employee_id());

CREATE POLICY "attendance_approval_employee_insert" ON attendance_approval_requests
  FOR INSERT WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'pending'
  );

COMMIT;
