-- Let an employee submit their own pending leave without RLS WITH CHECK
-- mismatches (client employee_id vs current_employee_id()).
-- Run in Supabase SQL Editor if not applied via CLI.

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_own_leave(
  p_id uuid,
  p_leave_type text,
  p_from_date date,
  p_to_date date,
  p_reason text,
  p_comp_off_work_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp employees%ROWTYPE;
BEGIN
  SELECT * INTO emp
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF emp.id IS NULL THEN
    RAISE EXCEPTION 'Your login is not linked to an employee record. Log out and log in again.';
  END IF;

  IF p_leave_type NOT IN ('Casual', 'Sick', 'Unpaid', 'Comp Off') THEN
    RAISE EXCEPTION 'Invalid leave type.';
  END IF;

  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Invalid leave dates.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Please provide a reason (at least 10 characters).';
  END IF;

  INSERT INTO leave_requests (
    id,
    employee_id,
    employee_name,
    leave_type,
    from_date,
    to_date,
    reason,
    status,
    admin_notes,
    comp_off_work_date
  ) VALUES (
    COALESCE(p_id, uuid_generate_v4()),
    emp.id,
    emp.name,
    p_leave_type,
    p_from_date,
    p_to_date,
    trim(p_reason),
    'pending',
    '',
    p_comp_off_work_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_own_leave(uuid, text, date, date, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_own_leave(uuid, text, date, date, text, date) TO authenticated;

COMMIT;
