-- Rename Collection Executive department and Collection workflow stage → Bill Submission
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

-- Update existing rows
UPDATE employees SET department = 'Bill Submission' WHERE department = 'Collection Executive';
UPDATE departments SET name = 'Bill Submission', description = 'Bill submission to hospitals.' WHERE name = 'Collection Executive';
UPDATE cases SET current_department = 'Bill Submission' WHERE current_department = 'Collection Executive';
UPDATE cases SET current_stage = 'Bill Submission' WHERE current_stage = 'Collection';
UPDATE approvals SET stage = 'Bill Submission' WHERE stage = 'Collection';

-- Update stage names inside cases.stages JSONB
UPDATE cases
SET stages = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem->>'stage' = 'Collection'
        THEN jsonb_set(
          CASE WHEN elem->>'department' = 'Collection Executive'
            THEN jsonb_set(elem, '{department}', '"Bill Submission"')
            ELSE elem
          END,
          '{stage}', '"Bill Submission"'
        )
      WHEN elem->>'department' = 'Collection Executive'
        THEN jsonb_set(elem, '{department}', '"Bill Submission"')
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(stages) AS elem
)
WHERE stages::text LIKE '%Collection%';

-- employees.department constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE employees ADD CONSTRAINT employees_department_check CHECK (department IN (
  'Stores', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Admin'
));

-- departments.name constraint
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_check;
ALTER TABLE departments ADD CONSTRAINT departments_name_check CHECK (name IN (
  'Stores', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Admin'
));

-- cases.current_stage constraint
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;
ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Kit Preparation','Surgery','Cleaning','Audit','Billing','Bill Submission','Completed'
));

-- cases.current_department constraint
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_department_check;
ALTER TABLE cases ADD CONSTRAINT cases_current_department_check CHECK (current_department IN (
  'Stores','Scrub Person','Cleaning Department','Stores Audit',
  'Accounts','Bill Submission','Admin'
));

COMMIT;
