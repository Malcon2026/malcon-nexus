-- Run once in Supabase Dashboard → SQL Editor
-- Allows a signed-in user to create their own employee row (bootstrap / provisioning)

DROP POLICY IF EXISTS "employees_self_insert" ON employees;

CREATE POLICY "employees_self_insert" ON employees
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND lower(email) = lower(auth.jwt() ->> 'email')
);
