-- Dedicated petrol-desk login (role = petrol).
-- Can issue tokens / view receipts. Cannot access cases, attendance, or expenses.
-- Run in Supabase Dashboard → SQL Editor after add-petrol-requests.sql

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin', 'employee', 'petrol'));

DROP POLICY IF EXISTS "petrol_admin_all" ON petrol_requests;
CREATE POLICY "petrol_admin_all" ON petrol_requests
  FOR ALL USING (current_user_role() IN ('admin', 'petrol'));

COMMIT;
