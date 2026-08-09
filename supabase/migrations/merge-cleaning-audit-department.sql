-- Merge Cleaning Department + Stores Audit into "Cleaning & Audit"
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_check;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_department_check;

UPDATE employees
SET department = 'Cleaning & Audit'
WHERE department IN ('Cleaning Department', 'Stores Audit');

UPDATE cases
SET current_department = 'Cleaning & Audit'
WHERE current_department IN ('Cleaning Department', 'Stores Audit');

UPDATE departments
SET
  name = 'Cleaning & Audit',
  description = 'Sterilization, cleaning, and audit of surgical kits.',
  color = 'bg-cyan-100 text-cyan-800'
WHERE name = 'Cleaning Department';

INSERT INTO departments (id, name, description, color) VALUES
  ('11111111-0001-0001-0001-000000000003', 'Cleaning & Audit', 'Sterilization, cleaning, and audit of surgical kits.', 'bg-cyan-100 text-cyan-800')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color;

DELETE FROM departments
WHERE name IN ('Cleaning Department', 'Stores Audit');

ALTER TABLE employees ADD CONSTRAINT employees_department_check CHECK (department IN (
  'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning & Audit',
  'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
));

ALTER TABLE departments ADD CONSTRAINT departments_name_check CHECK (name IN (
  'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning & Audit',
  'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
));

ALTER TABLE cases ADD CONSTRAINT cases_current_department_check CHECK (
  current_department IS NULL OR current_department IN (
    'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning & Audit',
    'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
  )
);

COMMIT;
