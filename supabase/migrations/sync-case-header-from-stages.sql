-- Heal case header drift + allow stage assignees to save when header points elsewhere.
-- Run in Supabase SQL Editor if employees see "assigned to another employee" on submit.
-- Full parallel workflow: also run fix-cases-parallel-workflow-rls.sql (RLS policies).

BEGIN;

CREATE OR REPLACE FUNCTION public.employee_is_assignee_on_open_stage(stages jsonb, emp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT emp_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(stages, '[]'::jsonb)) elem
      WHERE elem->'assignedEmployee'->>'id' = emp_id::text
        AND COALESCE(elem->>'status', 'Pending') IN (
          'Pending', 'Assigned', 'In Progress', 'Changes Requested', 'Rejected', 'Submitted'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.employee_is_assignee_on_stages(stages jsonb, emp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT emp_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(stages, '[]'::jsonb)) elem
      WHERE elem->'assignedEmployee'->>'id' = emp_id::text
         OR elem->'assistantEmployee'->>'id' = emp_id::text
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_case_header_from_stages(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_id uuid;
  role text;
  row cases%ROWTYPE;
  elem jsonb;
  pick_stage text;
  pick_dept text;
  pick_emp jsonb;
  pick_status text;
  st text;
BEGIN
  emp_id := current_employee_id();
  role := COALESCE(current_user_role(), '');
  IF role = 'admin' OR emp_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO row FROM cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found.';
  END IF;

  IF NOT employee_is_assignee_on_stages(row.stages, emp_id) THEN
    RAISE EXCEPTION 'You are not assigned on this case.';
  END IF;

  pick_stage := NULL;
  FOR elem IN SELECT value FROM jsonb_array_elements(COALESCE(row.stages, '[]'::jsonb)) AS t(value)
  LOOP
    st := COALESCE(elem->>'stage', '');
    IF st = 'Completed' THEN
      CONTINUE;
    END IF;
    IF COALESCE(elem->>'status', 'Pending') = 'Approved' THEN
      CONTINUE;
    END IF;
    pick_stage := st;
    pick_dept := NULL;
    pick_emp := elem->'assignedEmployee';
    pick_status := COALESCE(elem->>'status', 'Pending');
    EXIT;
  END LOOP;

  IF pick_stage IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(row.stages, '[]'::jsonb)) e
      WHERE e->>'stage' = 'Restock' AND e->>'status' = 'Approved'
    ) THEN
      pick_stage := 'Completed';
      pick_dept := NULL;
      pick_emp := NULL;
      pick_status := 'Approved';
    ELSE
      RETURN;
    END IF;
  END IF;

  UPDATE cases SET
    current_stage = pick_stage,
    current_department = pick_dept,
    assigned_employee_id = NULLIF(trim(pick_emp->>'id'), '')::uuid,
    assigned_employee_snapshot = pick_emp,
    status = CASE
      WHEN pick_status = 'Submitted' THEN 'Waiting For Approval'
      WHEN pick_status = 'Changes Requested' THEN 'Changes Requested'
      WHEN pick_status = 'Rejected' THEN 'Rejected'
      WHEN pick_emp IS NOT NULL THEN 'Active'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_case_for_session(p_case jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_id uuid;
  role text;
  case_id uuid;
  existing cases%ROWTYPE;
BEGIN
  emp_id := current_employee_id();
  role := COALESCE(current_user_role(), '');
  case_id := NULLIF(trim(p_case->>'id'), '')::uuid;

  IF case_id IS NULL THEN
    RAISE EXCEPTION 'Invalid case id.';
  END IF;

  SELECT * INTO existing FROM cases WHERE id = case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found in database. Refresh the page or ask admin to confirm the case was created.';
  END IF;

  IF role <> 'admin' THEN
    IF emp_id IS NULL THEN
      RAISE EXCEPTION 'Your login is not linked to an employee profile. Log out and sign in again.';
    END IF;
    IF existing.assigned_employee_id IS DISTINCT FROM emp_id
       AND NOT employee_is_assignee_on_open_stage(existing.stages, emp_id)
       AND NOT employee_is_assignee_on_stages(existing.stages, emp_id) THEN
      RAISE EXCEPTION 'This case is assigned to %, not you. Ask admin to reassign it.',
        COALESCE(existing.assigned_employee_snapshot->>'name', 'another employee');
    END IF;
  END IF;

  UPDATE cases SET
    case_number = COALESCE(p_case->>'case_number', case_number),
    hospital_id = COALESCE(NULLIF(p_case->>'hospital_id', '')::uuid, hospital_id),
    doctor_id = CASE WHEN p_case ? 'doctor_id' THEN NULLIF(p_case->>'doctor_id', '')::uuid ELSE doctor_id END,
    hospital_snapshot = COALESCE(p_case->'hospital_snapshot', hospital_snapshot),
    doctor_snapshot = COALESCE(p_case->'doctor_snapshot', doctor_snapshot),
    surgery_date = CASE WHEN p_case ? 'surgery_date' THEN NULLIF(p_case->>'surgery_date', '')::date ELSE surgery_date END,
    implant_required = COALESCE(p_case->>'implant_required', implant_required),
    implant_type = COALESCE(p_case->>'implant_type', implant_type),
    implant_company = COALESCE(p_case->>'implant_company', implant_company),
    priority = COALESCE(p_case->>'priority', priority),
    status = COALESCE(p_case->>'status', status),
    current_stage = COALESCE(p_case->>'current_stage', current_stage),
    current_department = CASE WHEN p_case ? 'current_department' THEN NULLIF(p_case->>'current_department', '') ELSE current_department END,
    assigned_employee_id = CASE WHEN p_case ? 'assigned_employee_id' THEN NULLIF(p_case->>'assigned_employee_id', '')::uuid ELSE assigned_employee_id END,
    assigned_employee_snapshot = CASE WHEN p_case ? 'assigned_employee_snapshot' THEN p_case->'assigned_employee_snapshot' ELSE assigned_employee_snapshot END,
    created_by = COALESCE(p_case->>'created_by', created_by),
    due_date = CASE WHEN p_case ? 'due_date' THEN NULLIF(p_case->>'due_date', '')::date ELSE due_date END,
    remarks = COALESCE(p_case->>'remarks', remarks),
    stages = COALESCE(p_case->'stages', stages),
    activity_logs = COALESCE(p_case->'activity_logs', activity_logs),
    comments = COALESCE(p_case->'comments', comments),
    post_surgery_duties = CASE WHEN p_case ? 'post_surgery_duties' THEN p_case->'post_surgery_duties' ELSE post_surgery_duties END,
    invoice_amount = CASE WHEN p_case ? 'invoice_amount' THEN NULLIF(p_case->>'invoice_amount', '')::numeric ELSE invoice_amount END,
    collected_amount = CASE WHEN p_case ? 'collected_amount' THEN NULLIF(p_case->>'collected_amount', '')::numeric ELSE collected_amount END,
    payment_status = CASE WHEN p_case ? 'payment_status' THEN NULLIF(p_case->>'payment_status', '') ELSE payment_status END,
    cancel_reason = COALESCE(p_case->>'cancel_reason', cancel_reason),
    postpone_reason = COALESCE(p_case->>'postpone_reason', postpone_reason),
    postponed_from = CASE WHEN p_case ? 'postponed_from' THEN NULLIF(p_case->>'postponed_from', '')::date ELSE postponed_from END,
    surgery_outcome = COALESCE(p_case->>'surgery_outcome', surgery_outcome),
    surgery_outcome_detail = COALESCE(p_case->>'surgery_outcome_detail', surgery_outcome_detail),
    updated_at = NOW()
  WHERE id = case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_case_header_from_stages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_case_header_from_stages(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.save_case_for_session(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_case_for_session(jsonb) TO authenticated;

COMMIT;
