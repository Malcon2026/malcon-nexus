-- Fix FCFS pool visibility: RTD (Pickup from Hospital) can be claimed by Drivers OR Delivery staff.
-- Run in Supabase Dashboard → SQL Editor (after add-fcfs-case-pool.sql).

BEGIN;

CREATE OR REPLACE FUNCTION employee_can_claim_fcfs_case(case_stage TEXT, case_dept TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = current_employee_id()
      AND e.status = 'Active'
      AND (
        (case_stage = 'Pickup from Hospital'
          AND case_dept = 'Delivery'
          AND e.department IN ('Delivery', 'Drivers'))
        OR (case_stage = 'Billing'
          AND case_dept = 'Accounts'
          AND e.department = 'Accounts')
        OR (case_stage = 'Bill Submission'
          AND case_dept = 'Bill Submission'
          AND e.department = 'Bill Submission')
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "cases_employee_fcfs_pool" ON cases;
CREATE POLICY "cases_employee_fcfs_pool" ON cases FOR SELECT USING (
  assigned_employee_id IS NULL
  AND status IN ('Active', 'Draft')
  AND current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission')
  AND employee_can_claim_fcfs_case(current_stage, current_department)
);

DROP POLICY IF EXISTS "cases_employee_fcfs_claim" ON cases;
CREATE POLICY "cases_employee_fcfs_claim" ON cases FOR UPDATE
USING (
  assigned_employee_id IS NULL
  AND status IN ('Active', 'Draft')
  AND current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission')
  AND employee_can_claim_fcfs_case(current_stage, current_department)
)
WITH CHECK (assigned_employee_id = current_employee_id());

-- Promote legacy Draft FCFS pool rows so they show on Live/TV boards.
UPDATE cases
SET status = 'Active', updated_at = NOW()
WHERE assigned_employee_id IS NULL
  AND status = 'Draft'
  AND current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission');

COMMIT;
