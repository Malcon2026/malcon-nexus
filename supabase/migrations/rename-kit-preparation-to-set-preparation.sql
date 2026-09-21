-- Rename workflow stage Kit Preparation → Set Preparation (display + stored value).
-- Run once in Supabase SQL Editor.

BEGIN;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;
ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Set Preparation',
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Restock',
  'Billing',
  'Bill Submission',
  'Completed'
));

UPDATE cases
SET current_stage = 'Set Preparation'
WHERE current_stage = 'Kit Preparation';

UPDATE cases
SET stages = replace(stages::text, '"Kit Preparation"', '"Set Preparation"')::jsonb
WHERE stages::text LIKE '%Kit Preparation%';

COMMIT;
