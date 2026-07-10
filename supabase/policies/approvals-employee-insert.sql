-- Allow assigned employees to create approval rows when submitting work
-- Run once in Supabase SQL Editor

DROP POLICY IF EXISTS "approvals_employee_insert" ON approvals;

CREATE POLICY "approvals_employee_insert" ON approvals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = approvals.case_id
      AND cases.assigned_employee_id = current_employee_id()
  )
);
