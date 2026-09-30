-- Rename workflow stage + department label: Cleaning & Audit → Checking & Audit
-- Run in Supabase SQL Editor once.

BEGIN;

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
        THEN jsonb_set(elem, '{stage}', '"Checking & Audit"')
      WHEN elem->>'department' IN ('Cleaning & Audit', 'Cleaning Department', 'Stores Audit', 'Cleaning', 'Audit')
        THEN jsonb_set(
          jsonb_set(elem, '{department}', '"Checking & Audit"'),
          '{stage}',
          to_jsonb(
            CASE
              WHEN elem->>'stage' IN ('Cleaning & Audit', 'Cleaning', 'Audit') THEN 'Checking & Audit'
              ELSE elem->>'stage'
            END
          )
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(stages) AS elem
)
WHERE stages::text LIKE '%Cleaning%'
   OR stages::text LIKE '%"Audit"%';

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

UPDATE departments
SET name = 'Checking & Audit',
    description = 'Kit checking and audit after return from hospital.'
WHERE name IN ('Cleaning & Audit', 'Cleaning Department', 'Stores Audit');

COMMIT;
