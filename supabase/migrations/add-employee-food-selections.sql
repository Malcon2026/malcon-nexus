-- Employee daily meal choices (breakfast / lunch / dinner)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS employee_food_selections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name   TEXT NOT NULL DEFAULT '',
  meal_date       DATE NOT NULL,
  breakfast       BOOLEAN NOT NULL DEFAULT false,
  lunch           BOOLEAN NOT NULL DEFAULT false,
  dinner          BOOLEAN NOT NULL DEFAULT false,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_food_one_per_day UNIQUE (employee_id, meal_date)
);

CREATE INDEX IF NOT EXISTS idx_food_selections_meal_date ON employee_food_selections(meal_date DESC);
CREATE INDEX IF NOT EXISTS idx_food_selections_employee_id ON employee_food_selections(employee_id);

ALTER TABLE employee_food_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "food_admin_all" ON employee_food_selections;
DROP POLICY IF EXISTS "food_employee_own" ON employee_food_selections;

CREATE POLICY "food_admin_all" ON employee_food_selections
  FOR ALL USING (current_user_role() = 'admin');

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
