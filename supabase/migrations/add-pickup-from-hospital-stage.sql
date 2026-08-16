-- Add "Pickup from Hospital" workflow stage (Delivery dept) after Surgery, before Cleaning & Audit
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;

-- Insert the new stage into existing case histories right after "Surgery" so
-- the timeline stays complete. Cases that have already moved past Surgery
-- keep their current_stage untouched — this only backfills the stages array.
DO $$
DECLARE
  r RECORD;
  pickup_stage jsonb;
  surgery_idx int;
BEGIN
  pickup_stage := jsonb_build_object(
    'stage', 'Pickup from Hospital',
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
      SELECT 1 FROM jsonb_array_elements(r.stages) e WHERE e->>'stage' = 'Pickup from Hospital'
    ) THEN
      SELECT (idx - 1) INTO surgery_idx
      FROM jsonb_array_elements(r.stages) WITH ORDINALITY AS t(elem, idx)
      WHERE t.elem->>'stage' = 'Surgery';

      IF surgery_idx IS NOT NULL THEN
        UPDATE cases
        SET stages = jsonb_insert(r.stages, ('{' || (surgery_idx + 1) || '}')::text[], pickup_stage)
        WHERE id = r.id;
      ELSE
        -- No Surgery entry found (unexpected/legacy) — append at the end so nothing is lost.
        UPDATE cases
        SET stages = r.stages || jsonb_build_array(pickup_stage)
        WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;

ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Kit Preparation','Delivery','Surgery','Pickup from Hospital','Cleaning & Audit','Billing','Bill Submission','Completed'
));

COMMIT;
