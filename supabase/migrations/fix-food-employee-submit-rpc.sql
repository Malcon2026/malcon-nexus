-- Employee food submit via RPC (avoids RLS / upsert issues)
-- Run in Supabase Dashboard → SQL Editor after employee_food_selections exists.

BEGIN;

ALTER TABLE employee_food_selections
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.submit_own_food_meals(
  p_meal_date date,
  p_breakfast boolean,
  p_lunch boolean,
  p_dinner boolean
)
RETURNS employee_food_selections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp employees%ROWTYPE;
  result employee_food_selections%ROWTYPE;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO emp
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF emp.id IS NULL THEN
    RAISE EXCEPTION 'Your login is not linked to an employee record. Log out and log in again.';
  END IF;

  IF NOT (COALESCE(p_breakfast, false) OR COALESCE(p_lunch, false) OR COALESCE(p_dinner, false)) THEN
    RAISE EXCEPTION 'Select at least one meal.';
  END IF;

  INSERT INTO employee_food_selections (
    employee_id,
    employee_name,
    meal_date,
    breakfast,
    lunch,
    dinner,
    submitted_at,
    created_at,
    updated_at
  ) VALUES (
    emp.id,
    emp.name,
    p_meal_date,
    COALESCE(p_breakfast, false),
    COALESCE(p_lunch, false),
    COALESCE(p_dinner, false),
    now_ts,
    now_ts,
    now_ts
  )
  ON CONFLICT (employee_id, meal_date) DO UPDATE
  SET
    breakfast = EXCLUDED.breakfast,
    lunch = EXCLUDED.lunch,
    dinner = EXCLUDED.dinner,
    submitted_at = EXCLUDED.submitted_at,
    employee_name = EXCLUDED.employee_name,
    updated_at = EXCLUDED.updated_at
  WHERE employee_food_selections.submitted_at IS NULL
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Meals for this day are already submitted and cannot be changed.';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_own_food_meals(date, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_own_food_meals(date, boolean, boolean, boolean) TO authenticated;

DROP POLICY IF EXISTS "food_employee_own" ON employee_food_selections;
DROP POLICY IF EXISTS "food_employee_insert" ON employee_food_selections;
DROP POLICY IF EXISTS "food_employee_update_once" ON employee_food_selections;

CREATE POLICY "food_employee_select" ON employee_food_selections
  FOR SELECT USING (employee_id = current_employee_id());

COMMIT;
