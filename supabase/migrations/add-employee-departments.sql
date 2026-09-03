-- Multi-department employees (e.g. Scrub Person + Delivery on one profile).
-- Run in Supabase Dashboard → SQL Editor.

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS departments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: primary department in the array when empty.
UPDATE employees
SET departments = jsonb_build_array(department)
WHERE departments = '[]'::jsonb OR departments IS NULL;

CREATE OR REPLACE FUNCTION employee_has_department_tag(e employees, tag TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    e.department = tag
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(e.departments, '[]'::jsonb)) d
      WHERE d = tag
    );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION employee_can_claim_fcfs_case(case_stage TEXT, case_dept TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = current_employee_id()
      AND e.status = 'Active'
      AND (
        (case_stage = 'Pickup from Hospital'
          AND case_dept = 'Delivery'
          AND (
            employee_has_department_tag(e, 'Delivery')
            OR employee_has_department_tag(e, 'Drivers')
          ))
        OR (case_stage = 'Billing'
          AND case_dept = 'Accounts'
          AND employee_has_department_tag(e, 'Accounts'))
        OR (case_stage = 'Bill Submission'
          AND case_dept = 'Bill Submission'
          AND employee_has_department_tag(e, 'Bill Submission'))
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMIT;
