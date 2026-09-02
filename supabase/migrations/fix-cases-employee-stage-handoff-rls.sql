-- Fix: employee stage submit fails with
--   "new row violates row-level security policy for table cases"
--
-- Cause: cases_employee_update had no explicit WITH CHECK, so Postgres defaults
-- WITH CHECK to the same rule as USING (assigned_employee_id = current employee).
-- After Delivery submit the app auto-advances and sets assigned_employee_id to the
-- next stage person (or NULL for FCFS pool) — the NEW row no longer matches the
-- current employee, so the update is rejected even though the photo upload succeeded.
--
-- Fix: keep USING (only rows currently assigned to you) but allow the updated row
-- to change assignee / stage fields so employees can complete handoff on submit.
--
-- Run in Supabase Dashboard → SQL Editor.

BEGIN;

DROP POLICY IF EXISTS "cases_employee_update" ON cases;
CREATE POLICY "cases_employee_update" ON cases FOR UPDATE
  USING (assigned_employee_id = current_employee_id())
  WITH CHECK (true);

COMMIT;
