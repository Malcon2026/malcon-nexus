-- Admin-only manual daily expense log per employee: kms driven, petrol, food,
-- and other expenses. No employee-facing submission — admins enter/edit/delete
-- everything. One row per employee per date (upserted from the app).
-- Run in Supabase Dashboard -> SQL Editor (or via `supabase db query --linked`).

BEGIN;

CREATE TABLE IF NOT EXISTS employee_daily_expenses (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name      TEXT NOT NULL DEFAULT '',
  expense_date       DATE NOT NULL,
  kms_driven         NUMERIC NOT NULL DEFAULT 0,
  petrol_amount      NUMERIC NOT NULL DEFAULT 0,
  food_amount        NUMERIC NOT NULL DEFAULT 0,
  other_amount       NUMERIC NOT NULL DEFAULT 0,
  other_description  TEXT NOT NULL DEFAULT '',
  notes              TEXT NOT NULL DEFAULT '',
  entered_by         TEXT NOT NULL DEFAULT '',
  entered_by_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_daily_expenses_one_per_day UNIQUE (employee_id, expense_date)
);

CREATE INDEX IF NOT EXISTS idx_expenses_employee_id ON employee_daily_expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON employee_daily_expenses(expense_date DESC);

ALTER TABLE employee_daily_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_admin_all" ON employee_daily_expenses;

-- Admin-only, full access. Employees never read or write this table.
CREATE POLICY "expenses_admin_all" ON employee_daily_expenses
  FOR ALL USING (current_user_role() = 'admin');

COMMIT;
