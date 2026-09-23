-- Post-surgery duty assignees (JSON) + remove mistaken "Return to Hospital" workflow stage.
-- Run in Supabase SQL Editor.

BEGIN;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS post_surgery_duties JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE cases
SET current_stage = 'Cleaning & Audit'
WHERE current_stage = 'Return to Hospital';

UPDATE cases
SET stages = (
  SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
  FROM (
    SELECT elem, ord
    FROM jsonb_array_elements(stages) WITH ORDINALITY AS t(elem, ord)
    WHERE elem->>'stage' <> 'Return to Hospital'
  ) s
)
WHERE stages::text LIKE '%Return to Hospital%';

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

COMMIT;
