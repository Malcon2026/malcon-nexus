-- Fix: allow role = store_manager on employees (e.g. Chandra).
-- Run in Supabase Dashboard → SQL Editor if you see:
--   violates check constraint "employees_role_check"
--
-- After this, run add-store-manager-role.sql (policies + save_case RPC)
-- if you have not already.

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;

UPDATE employees SET role = 'store_manager' WHERE role = 'case_manager';

ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin', 'employee', 'petrol', 'store_manager'));

COMMIT;
