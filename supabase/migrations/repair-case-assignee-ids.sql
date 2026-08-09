-- Repair cases employees cannot see: snapshot has assignee but FK is null.
-- Also re-link current assignee from the active stage when FK is missing.
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

-- 1) Restore assigned_employee_id from snapshot when FK was dropped/null
UPDATE cases
SET assigned_employee_id = (assigned_employee_snapshot->>'id')::uuid
WHERE assigned_employee_id IS NULL
  AND assigned_employee_snapshot->>'id' IS NOT NULL
  AND (assigned_employee_snapshot->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 2) If still null, take assignee from the current stage record in stages JSON
UPDATE cases
SET
  assigned_employee_id = (stage_emp->>'id')::uuid,
  assigned_employee_snapshot = COALESCE(assigned_employee_snapshot, stage_emp)
FROM (
  SELECT
    c.id AS case_id,
    elem->'assignedEmployee' AS stage_emp
  FROM cases c
  CROSS JOIN LATERAL jsonb_array_elements(c.stages) AS elem
  WHERE c.assigned_employee_id IS NULL
    AND elem->>'stage' IN (c.current_stage, 'Cleaning', 'Audit', 'Cleaning & Audit')
    AND (
      elem->>'stage' = c.current_stage
      OR (
        c.current_stage IN ('Cleaning', 'Audit', 'Cleaning & Audit')
        AND elem->>'stage' IN ('Cleaning', 'Audit', 'Cleaning & Audit')
      )
    )
    AND elem->'assignedEmployee'->>'id' IS NOT NULL
) src
WHERE cases.id = src.case_id
  AND src.stage_emp->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

COMMIT;
