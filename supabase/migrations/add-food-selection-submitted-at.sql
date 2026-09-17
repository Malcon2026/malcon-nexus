-- Lock employee food choices after one submit (no edits)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE employee_food_selections
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Treat existing saved rows as already submitted
UPDATE employee_food_selections
SET submitted_at = COALESCE(submitted_at, updated_at)
WHERE submitted_at IS NULL
  AND (breakfast OR lunch OR dinner);

DROP POLICY IF EXISTS "food_employee_own" ON employee_food_selections;
DROP POLICY IF EXISTS "food_employee_select" ON employee_food_selections;
DROP POLICY IF EXISTS "food_employee_insert" ON employee_food_selections;
DROP POLICY IF EXISTS "food_employee_update_once" ON employee_food_selections;

CREATE POLICY "food_employee_select" ON employee_food_selections
  FOR SELECT USING (employee_id = current_employee_id());

CREATE POLICY "food_employee_insert" ON employee_food_selections
  FOR INSERT WITH CHECK (
    employee_id = current_employee_id()
    AND submitted_at IS NOT NULL
  );

CREATE POLICY "food_employee_update_once" ON employee_food_selections
  FOR UPDATE USING (
    employee_id = current_employee_id()
    AND submitted_at IS NULL
  )
  WITH CHECK (
    employee_id = current_employee_id()
    AND submitted_at IS NOT NULL
  );

COMMIT;
