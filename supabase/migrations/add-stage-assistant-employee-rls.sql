-- Allow employees to read cases where they are the extra (assistant) person on the current stage.
-- Primary assignee still required for UPDATE / submit (unchanged).

DROP POLICY IF EXISTS "cases_employee_assigned" ON cases;

CREATE POLICY "cases_employee_assigned" ON cases FOR SELECT USING (
  assigned_employee_id = current_employee_id()
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(stages, '[]'::jsonb)) AS elem
    WHERE elem->'assistantEmployee'->>'id' = current_employee_id()::text
      AND elem->>'stage' = cases.current_stage
  )
);
