-- Daily attendance credit for Stores / Scrub / Delivery (punches logged; present only after admin approval)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS field_team_attendance_approvals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name   TEXT NOT NULL DEFAULT '',
  department      TEXT NOT NULL DEFAULT '',
  date_key        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     TEXT,
  reviewed_by_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  admin_notes     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, date_key)
);

CREATE INDEX IF NOT EXISTS idx_field_team_attendance_date
  ON field_team_attendance_approvals(date_key DESC);
CREATE INDEX IF NOT EXISTS idx_field_team_attendance_status
  ON field_team_attendance_approvals(status);

ALTER TABLE field_team_attendance_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_team_attendance_admin_all" ON field_team_attendance_approvals;
DROP POLICY IF EXISTS "field_team_attendance_employee_read" ON field_team_attendance_approvals;

CREATE POLICY "field_team_attendance_admin_all" ON field_team_attendance_approvals
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "field_team_attendance_employee_read" ON field_team_attendance_approvals
  FOR SELECT USING (employee_id = current_employee_id());

COMMIT;
