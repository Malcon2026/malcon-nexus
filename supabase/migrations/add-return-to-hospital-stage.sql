-- Add "Return to Hospital" after Cleaning & Audit, before Restock.
-- Run in Supabase SQL Editor if not applied via CLI.

BEGIN;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_stage_check;

DO $$
DECLARE
  r RECORD;
  rth_stage jsonb;
  cleaning_idx int;
BEGIN
  rth_stage := jsonb_build_object(
    'stage', 'Return to Hospital',
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
      SELECT 1 FROM jsonb_array_elements(r.stages) e WHERE e->>'stage' = 'Return to Hospital'
    ) THEN
      SELECT (idx - 1) INTO cleaning_idx
      FROM jsonb_array_elements(r.stages) WITH ORDINALITY AS t(elem, idx)
      WHERE t.elem->>'stage' = 'Restock';

      IF cleaning_idx IS NOT NULL THEN
        UPDATE cases
        SET stages = jsonb_insert(r.stages, ('{' || cleaning_idx || '}')::text[], rth_stage)
        WHERE id = r.id;
      ELSE
        SELECT (idx - 1) INTO cleaning_idx
        FROM jsonb_array_elements(r.stages) WITH ORDINALITY AS t(elem, idx)
        WHERE t.elem->>'stage' = 'Cleaning & Audit';

        IF cleaning_idx IS NOT NULL THEN
          UPDATE cases
          SET stages = jsonb_insert(r.stages, ('{' || (cleaning_idx + 1) || '}')::text[], rth_stage)
          WHERE id = r.id;
        ELSE
          UPDATE cases
          SET stages = r.stages || jsonb_build_array(rth_stage)
          WHERE id = r.id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

ALTER TABLE cases ADD CONSTRAINT cases_current_stage_check CHECK (current_stage IN (
  'Set Preparation',
  'Kit Preparation',
  'Delivery',
  'Surgery',
  'Pickup from Hospital',
  'Cleaning & Audit',
  'Return to Hospital',
  'Restock',
  'Billing',
  'Bill Submission',
  'Completed'
));

COMMIT;
