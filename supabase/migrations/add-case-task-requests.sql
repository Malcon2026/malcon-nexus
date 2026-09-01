-- Pool stages: employees request tasks; admin approves who gets assigned.
-- Run in Supabase Dashboard → SQL Editor (after add-fcfs-case-pool.sql).

BEGIN;

CREATE TABLE IF NOT EXISTS case_task_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  case_number         TEXT NOT NULL,
  stage               TEXT NOT NULL,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name       TEXT NOT NULL DEFAULT '',
  employee_department TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by         TEXT,
  reviewed_by_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  admin_notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_case_task_requests_case_id ON case_task_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_case_task_requests_status ON case_task_requests(status);
CREATE INDEX IF NOT EXISTS idx_case_task_requests_employee_id ON case_task_requests(employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_task_requests_one_pending
  ON case_task_requests(case_id, employee_id)
  WHERE status = 'pending';

ALTER TABLE case_task_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_task_requests_admin_all" ON case_task_requests;
CREATE POLICY "case_task_requests_admin_all" ON case_task_requests
  FOR ALL USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "case_task_requests_employee_read_own" ON case_task_requests;
CREATE POLICY "case_task_requests_employee_read_own" ON case_task_requests
  FOR SELECT USING (employee_id = current_employee_id());

DROP POLICY IF EXISTS "case_task_requests_employee_insert" ON case_task_requests;
CREATE POLICY "case_task_requests_employee_insert" ON case_task_requests
  FOR INSERT WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
        AND c.assigned_employee_id IS NULL
        AND c.status IN ('Active', 'Draft')
        AND c.current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission')
        AND employee_can_claim_fcfs_case(c.current_stage, c.current_department)
    )
  );

-- Employees no longer assign themselves via case UPDATE (request + admin assign only).
DROP POLICY IF EXISTS "cases_employee_fcfs_claim" ON cases;

COMMIT;
