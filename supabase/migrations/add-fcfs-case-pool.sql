-- FCFS case pool: employees can see and claim unassigned RTD / Billing / Bill Submission cases.
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

CREATE OR REPLACE FUNCTION employee_matches_case_department(case_dept TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = current_employee_id()
      AND e.status = 'Active'
      AND e.department = case_dept
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "cases_employee_fcfs_pool" ON cases;
CREATE POLICY "cases_employee_fcfs_pool" ON cases FOR SELECT USING (
  assigned_employee_id IS NULL
  AND status = 'Active'
  AND current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission')
  AND employee_matches_case_department(current_department)
);

DROP POLICY IF EXISTS "cases_employee_fcfs_claim" ON cases;
CREATE POLICY "cases_employee_fcfs_claim" ON cases FOR UPDATE
USING (
  assigned_employee_id IS NULL
  AND status = 'Active'
  AND current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission')
  AND employee_matches_case_department(current_department)
)
WITH CHECK (assigned_employee_id = current_employee_id());

COMMIT;
