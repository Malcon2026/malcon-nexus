-- Stores department kiosk logins: cases + workflow only (no attendance/petrol/food).
-- Run in Supabase SQL Editor after deploy.

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin', 'employee', 'petrol', 'stores'));

-- Stores desk: read/update cases for kit prep / restock kiosk (no personal attendance data).
DROP POLICY IF EXISTS "cases_stores_select" ON cases;
DROP POLICY IF EXISTS "cases_stores_update" ON cases;

CREATE POLICY "cases_stores_select" ON cases
  FOR SELECT USING (current_user_role() = 'stores');

CREATE POLICY "cases_stores_update" ON cases
  FOR UPDATE USING (current_user_role() = 'stores')
  WITH CHECK (current_user_role() = 'stores');

COMMIT;
