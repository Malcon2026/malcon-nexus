-- Employee leave requests (Casual, Sick, Unpaid)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS leave_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name   TEXT NOT NULL DEFAULT '',
  leave_type      TEXT NOT NULL CHECK (leave_type IN ('Casual', 'Sick', 'Unpaid')),
  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  reason          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by     TEXT,
  reviewed_by_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  admin_notes     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_date_range CHECK (from_date <= to_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_from_date ON leave_requests(from_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_to_date ON leave_requests(to_date);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_admin_all" ON leave_requests;
DROP POLICY IF EXISTS "leave_employee_select" ON leave_requests;
DROP POLICY IF EXISTS "leave_employee_insert" ON leave_requests;
DROP POLICY IF EXISTS "leave_employee_cancel" ON leave_requests;

CREATE POLICY "leave_admin_all" ON leave_requests
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "leave_employee_select" ON leave_requests
  FOR SELECT USING (employee_id = current_employee_id());

CREATE POLICY "leave_employee_insert" ON leave_requests
  FOR INSERT WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'pending'
  );

CREATE POLICY "leave_employee_cancel" ON leave_requests
  FOR UPDATE USING (
    employee_id = current_employee_id()
    AND status = 'pending'
  )
  WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'cancelled'
  );

COMMIT;
