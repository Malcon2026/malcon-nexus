-- Production fix: employee stage submit (photos + auto-advance) must save case updates
-- even when RLS blocks direct table UPDATE (handoff to next assignee).
--
-- Also fixes "Case not found" when the app has the case in memory but getById()
-- is hidden by RLS — the RPC validates assignee server-side with SECURITY DEFINER.
--
-- Run in Supabase Dashboard → SQL Editor (after fix-cases-employee-stage-handoff-rls.sql).

BEGIN;

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
    IF existing.assigned_employee_id IS DISTINCT FROM emp_id THEN
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
    invoice_amount = CASE WHEN p_case ? 'invoice_amount' THEN NULLIF(p_case->>'invoice_amount', '')::numeric ELSE invoice_amount END,
    collected_amount = CASE WHEN p_case ? 'collected_amount' THEN NULLIF(p_case->>'collected_amount', '')::numeric ELSE collected_amount END,
    payment_status = CASE WHEN p_case ? 'payment_status' THEN NULLIF(p_case->>'payment_status', '') ELSE payment_status END,
    cancel_reason = COALESCE(p_case->>'cancel_reason', cancel_reason),
    postpone_reason = COALESCE(p_case->>'postpone_reason', postpone_reason),
    postponed_from = CASE WHEN p_case ? 'postponed_from' THEN NULLIF(p_case->>'postponed_from', '')::date ELSE postponed_from END,
    updated_at = NOW()
  WHERE id = case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_case_for_session(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_case_for_session(jsonb) TO authenticated;

COMMIT;

-- Verify: SELECT proname FROM pg_proc WHERE proname = 'save_case_for_session';
