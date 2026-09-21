-- Store manager role: OTP login, employee attendance, full case ops (no full admin).
-- Run in Supabase Dashboard → SQL Editor after add-petrol-desk-role.sql

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin', 'employee', 'petrol', 'store_manager'));

-- Cases: same write access as admin
DROP POLICY IF EXISTS "cases_admin_all" ON cases;
CREATE POLICY "cases_admin_all" ON cases
  FOR ALL USING (current_user_role() IN ('admin', 'store_manager'));

-- Assign dropdown + workload counts when reassigning
DROP POLICY IF EXISTS "employees_store_manager_select" ON employees;
CREATE POLICY "employees_store_manager_select" ON employees
  FOR SELECT USING (current_user_role() = 'store_manager');

DROP POLICY IF EXISTS "employees_store_manager_update" ON employees;
CREATE POLICY "employees_store_manager_update" ON employees
  FOR UPDATE
  USING (current_user_role() = 'store_manager')
  WITH CHECK (current_user_role() = 'store_manager');

-- Stage approval records tied to cases
DROP POLICY IF EXISTS "approvals_store_manager_all" ON approvals;
CREATE POLICY "approvals_store_manager_all" ON approvals
  FOR ALL USING (current_user_role() = 'store_manager');

-- Activity on case actions
DROP POLICY IF EXISTS "activity_store_manager_all" ON activity_log;
CREATE POLICY "activity_store_manager_all" ON activity_log
  FOR ALL USING (current_user_role() = 'store_manager');

-- Employee submit RPC: store managers save like admin
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

  IF role NOT IN ('admin', 'store_manager') THEN
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
    surgery_outcome = COALESCE(p_case->>'surgery_outcome', surgery_outcome),
    surgery_outcome_detail = COALESCE(p_case->>'surgery_outcome_detail', surgery_outcome_detail),
    updated_at = NOW()
  WHERE id = case_id;
END;
$$;

COMMIT;
