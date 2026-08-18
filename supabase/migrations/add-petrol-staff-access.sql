-- Let the petrol desk see the staff roster and add delivery boys for petrol entries.
-- Run in Supabase Dashboard → SQL Editor after add-petrol-desk-role.sql

BEGIN;

DROP POLICY IF EXISTS "employees_petrol_select" ON employees;
CREATE POLICY "employees_petrol_select" ON employees
  FOR SELECT USING (current_user_role() IN ('admin', 'petrol'));

DROP POLICY IF EXISTS "employees_petrol_insert" ON employees;
CREATE POLICY "employees_petrol_insert" ON employees
  FOR INSERT WITH CHECK (
    current_user_role() IN ('admin', 'petrol')
    AND role = 'employee'
  );

COMMIT;
