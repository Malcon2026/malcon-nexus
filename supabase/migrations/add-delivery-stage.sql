-- Add Delivery department and workflow stage (after Kit Preparation / Stores)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_check;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_department_check;

INSERT INTO departments (id, name, description, color) VALUES
  ('11111111-0001-0001-0001-000000000007', 'Delivery', 'Delivery of implant kits to hospitals.', 'bg-rose-100 text-rose-800')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color;

-- Insert Delivery stage into existing case histories (after Kit Preparation)
DO $$
DECLARE
  r RECORD;
  delivery_stage jsonb;
BEGIN
  delivery_stage := jsonb_build_object(
    'stage', 'Delivery',
    'department', 'Delivery',
    'assignedEmployee', null,
    'assignedAt', null,
    'submittedAt', null,
    'approvedAt', null,
    'status', 'Pending',
    'notes', '',
    'adminNotes', '',
    'documents', '[]'::jsonb
  );

  FOR r IN SELECT id, stages FROM cases WHERE stages IS NOT NULL AND jsonb_array_length(stages) > 0 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.stages) e WHERE e->>'stage' = 'Delivery'
    ) THEN
      UPDATE cases
      SET stages = jsonb_insert(r.stages, '{1}', delivery_stage)
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_department_check CHECK (department IN (
  'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Admin'
));

ALTER TABLE departments ADD CONSTRAINT departments_name_check CHECK (name IN (
  'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department',
  'Stores Audit', 'Accounts', 'Bill Submission', 'Admin'
));

ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Kit Preparation','Delivery','Surgery','Cleaning','Audit','Billing','Bill Submission','Completed'
));

ALTER TABLE cases ADD CONSTRAINT cases_current_department_check CHECK (current_department IN (
  'Stores','Delivery','Scrub Person','Cleaning Department','Stores Audit',
  'Accounts','Bill Submission','Admin'
));

COMMIT;
