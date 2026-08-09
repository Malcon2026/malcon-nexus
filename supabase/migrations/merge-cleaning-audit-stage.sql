-- Merge Cleaning + Audit workflow stages into "Cleaning & Audit"
-- Run in Supabase Dashboard → SQL Editor
-- (Safe to run after merge-cleaning-audit-department.sql)

BEGIN;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;

UPDATE cases
SET current_stage = 'Cleaning & Audit'
WHERE current_stage IN ('Cleaning', 'Audit');

UPDATE approvals
SET stage = 'Cleaning & Audit'
WHERE stage IN ('Cleaning', 'Audit');

-- Rewrite stages JSON: rename Cleaning/Audit → Cleaning & Audit, then collapse duplicates
UPDATE cases
SET stages = (
  SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (normalized_stage)
      CASE
        WHEN elem->>'stage' IN ('Cleaning', 'Audit', 'Cleaning & Audit')
          THEN jsonb_set(
            jsonb_set(elem, '{stage}', '"Cleaning & Audit"'),
            '{department}', '"Cleaning & Audit"'
          )
        ELSE elem
      END AS elem,
      CASE
        WHEN elem->>'stage' IN ('Cleaning', 'Audit', 'Cleaning & Audit') THEN 'Cleaning & Audit'
        ELSE elem->>'stage'
      END AS normalized_stage,
      CASE elem->>'status'
        WHEN 'Approved' THEN 4
        WHEN 'Submitted' THEN 3
        WHEN 'Rejected' THEN 3
        WHEN 'Changes Requested' THEN 2
        WHEN 'Assigned' THEN 1
        ELSE 0
      END AS status_rank,
      ord
    FROM jsonb_array_elements(stages) WITH ORDINALITY AS t(elem, ord)
    ORDER BY normalized_stage, status_rank DESC, ord DESC
  ) collapsed
)
WHERE stages::text LIKE '%Cleaning%'
   OR stages::text LIKE '%Audit%';

ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Kit Preparation','Delivery','Surgery','Cleaning & Audit','Billing','Bill Submission','Completed'
));

COMMIT;
