-- Rename workflow stage + department label: Cleaning & Audit → Checking & Audit
-- Run in Supabase SQL Editor (or: supabase db query --linked -f this file)

BEGIN;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;
ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (
  current_stage IN (
    'Set Preparation', 'Kit Preparation', 'Delivery', 'Surgery',
    'Pickup from Hospital', 'Cleaning & Audit', 'Checking & Audit',
    'Restock', 'Billing', 'Bill Submission', 'Completed'
  )
);

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_department_check;
ALTER TABLE cases ADD CONSTRAINT cases_current_department_check CHECK (
  current_department IS NULL OR current_department IN (
    'Stores', 'Delivery', 'Drivers', 'Scrub Person',
    'Cleaning & Audit', 'Checking & Audit',
    'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
  )
);

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE employees ADD CONSTRAINT employees_department_check CHECK (
  department IN (
    'Stores', 'Delivery', 'Drivers', 'Scrub Person',
    'Cleaning & Audit', 'Checking & Audit',
    'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
  )
);

UPDATE cases
SET current_stage = 'Checking & Audit'
WHERE current_stage IN ('Cleaning & Audit', 'Cleaning', 'Audit');

UPDATE cases
SET current_department = 'Checking & Audit'
WHERE current_department IN ('Cleaning & Audit', 'Cleaning Department', 'Stores Audit', 'Cleaning', 'Audit');

UPDATE cases
SET stages = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'stage' IN ('Cleaning & Audit', 'Cleaning', 'Audit')
        THEN jsonb_set(
          jsonb_set(elem, '{stage}', '"Checking & Audit"'),
          '{department}',
          to_jsonb(
            CASE
              WHEN COALESCE(elem->>'department', '') IN (
                'Cleaning & Audit', 'Cleaning Department', 'Stores Audit', 'Cleaning', 'Audit', ''
              ) THEN 'Checking & Audit'
              ELSE COALESCE(elem->>'department', 'Checking & Audit')
            END
          )
        )
      WHEN elem->>'department' IN ('Cleaning & Audit', 'Cleaning Department', 'Stores Audit', 'Cleaning', 'Audit')
        THEN jsonb_set(elem, '{department}', '"Checking & Audit"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(stages) AS elem
)
WHERE stages::text LIKE '%Cleaning%'
   OR stages::text LIKE '%Stores Audit%';

UPDATE employees
SET department = 'Checking & Audit'
WHERE department IN ('Cleaning & Audit', 'Cleaning Department', 'Cleaning');

UPDATE employees
SET departments = (
  SELECT jsonb_agg(
    CASE
      WHEN val #>> '{}' IN ('Cleaning & Audit', 'Cleaning Department', 'Cleaning', 'Audit', 'Stores Audit')
        THEN '"Checking & Audit"'::jsonb
      ELSE val
    END
  )
  FROM jsonb_array_elements(departments) AS val
)
WHERE departments::text LIKE '%Cleaning%'
   OR departments::text LIKE '%Stores Audit%';

ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_check;
ALTER TABLE departments ADD CONSTRAINT departments_name_check CHECK (
  name IN (
    'Stores', 'Delivery', 'Drivers', 'Scrub Person',
    'Cleaning & Audit', 'Checking & Audit',
    'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
  )
);

UPDATE departments
SET name = 'Checking & Audit',
    description = 'Kit checking and audit after return from hospital.'
WHERE name IN ('Cleaning & Audit', 'Cleaning Department', 'Stores Audit');

COMMIT;
