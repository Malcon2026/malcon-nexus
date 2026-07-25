-- Add Office Staff department
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_check;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_department_check;

INSERT INTO departments (id, name, description, color) VALUES
  ('11111111-0001-0001-0001-000000000009', 'Office Staff', 'Office and administrative support staff.', 'bg-slate-100 text-slate-800')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color;

ALTER TABLE employees ADD CONSTRAINT employees_department_check CHECK (department IN (
  'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
));

ALTER TABLE departments ADD CONSTRAINT departments_name_check CHECK (name IN (
  'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
));

ALTER TABLE cases ADD CONSTRAINT cases_current_department_check CHECK (current_department IN (
  'Stores', 'Delivery', 'Drivers', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Office Staff', 'Admin'
));

COMMIT;
