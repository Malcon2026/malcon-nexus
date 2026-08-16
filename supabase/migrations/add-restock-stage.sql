-- Add "Restock" workflow stage (Stores dept) after Cleaning & Audit, before Billing
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;

-- Backfill Restock into existing case timelines after Cleaning & Audit.
-- In-progress cases keep their current_stage — this only completes the stages array.
DO $$
DECLARE
  r RECORD;
  restock_stage jsonb;
  cleaning_idx int;
BEGIN
  restock_stage := jsonb_build_object(
    'stage', 'Restock',
    'department', 'Stores',
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
      SELECT 1 FROM jsonb_array_elements(r.stages) e WHERE e->>'stage' = 'Restock'
    ) THEN
      SELECT (idx - 1) INTO cleaning_idx
      FROM jsonb_array_elements(r.stages) WITH ORDINALITY AS t(elem, idx)
      WHERE t.elem->>'stage' = 'Cleaning & Audit';

      IF cleaning_idx IS NOT NULL THEN
        UPDATE cases
        SET stages = jsonb_insert(r.stages, ('{' || (cleaning_idx + 1) || '}')::text[], restock_stage)
        WHERE id = r.id;
      ELSE
        UPDATE cases
        SET stages = r.stages || jsonb_build_array(restock_stage)
        WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;

ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Kit Preparation','Delivery','Surgery','Pickup from Hospital','Cleaning & Audit','Restock','Billing','Bill Submission','Completed'
));

COMMIT;
