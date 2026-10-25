-- ============================================================================
-- Malcon Nexus — complete Supabase schema (public)
--
-- Target project: tukoefkroyxycwlkhaot ("Nexus", org fmoczbwjbztnvxgacwon)
-- Malcon Nexus is self-contained here; the Malcon DMS app keeps its own
-- project (ipometuqzcvdqeyvhcgg).
--
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: every statement is guarded (IF NOT EXISTS / DROP IF EXISTS).
--
-- What this does
--   1. Moves the DMS app's empty `doctors` / `hospitals` tables aside
--      (renamed to dms_doctors / dms_hospitals) so Malcon Nexus can own those
--      names. Skipped automatically if already renamed or if the tables look
--      like Nexus tables already.
--   2. Creates every Malcon Nexus table, index, trigger, function and RLS
--      policy (employees, doctors, hospitals, cases, attendance, leave,
--      expenses, petrol, location trips, notifications, settings, ...).
--   3. Seeds the 8 workflow departments and the default incentive setting.
--   4. Creates the storage buckets + policies used for photos/receipts.
--   5. Grants the anon / authenticated / service_role access PostgREST needs
--      (RLS still enforces row-level access).
--
-- Master data (employees, doctors, hospitals) is imported afterwards by
-- scripts/import-convex-master-data.mjs — no data is inserted here.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Resolve the DMS table-name collision (no-op on a clean project)
-- ---------------------------------------------------------------------------
DO $dms$
DECLARE
  r RECORD;
BEGIN
  -- DMS `doctors` has no `specialization` column; Nexus `doctors` does.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'doctors'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'specialization'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'dms_doctors'
    ) THEN
      RAISE EXCEPTION 'Both public.doctors (DMS) and public.dms_doctors exist — resolve manually.';
    END IF;
    ALTER TABLE public.doctors RENAME TO dms_doctors;
    -- Constraint / index names are schema-scoped in Postgres: move them out of
    -- the way too, otherwise creating the Nexus `doctors_pkey` collides.
    FOR r IN
      SELECT conname FROM pg_constraint WHERE conrelid = 'public.dms_doctors'::regclass AND conname LIKE 'doctors%'
    LOOP
      EXECUTE format('ALTER TABLE public.dms_doctors RENAME CONSTRAINT %I TO %I', r.conname, 'dms_' || r.conname);
    END LOOP;
    FOR r IN
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'dms_doctors' AND indexname LIKE 'doctors%'
    LOOP
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.indexname, 'dms_' || r.indexname);
    END LOOP;
    RAISE NOTICE 'Renamed DMS table public.doctors -> public.dms_doctors';
  END IF;

  -- DMS `hospitals` has no `branch` column; Nexus `hospitals` does.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hospitals'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'branch'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'dms_hospitals'
    ) THEN
      RAISE EXCEPTION 'Both public.hospitals (DMS) and public.dms_hospitals exist — resolve manually.';
    END IF;
    ALTER TABLE public.hospitals RENAME TO dms_hospitals;
    FOR r IN
      SELECT conname FROM pg_constraint WHERE conrelid = 'public.dms_hospitals'::regclass AND conname LIKE 'hospitals%'
    LOOP
      EXECUTE format('ALTER TABLE public.dms_hospitals RENAME CONSTRAINT %I TO %I', r.conname, 'dms_' || r.conname);
    END LOOP;
    FOR r IN
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'dms_hospitals' AND indexname LIKE 'hospitals%'
    LOOP
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.indexname, 'dms_' || r.indexname);
    END LOOP;
    RAISE NOTICE 'Renamed DMS table public.hospitals -> public.dms_hospitals';
  END IF;
END
$dms$;

-- ---------------------------------------------------------------------------
-- 2. Malcon Nexus schema
-- ---------------------------------------------------------------------------
SET check_function_bodies = false;
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (Homebrew)
-- Dumped by pg_dump version 18.4 (Homebrew)


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: current_employee_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.current_employee_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


--
-- Name: employee_can_claim_fcfs_case(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.employee_can_claim_fcfs_case(case_stage text, case_dept text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = current_employee_id()
      AND e.status = 'Active'
      AND (
        (case_stage = 'Pickup from Hospital'
          AND case_dept = 'Delivery'
          AND (
            employee_has_department_tag(e, 'Delivery')
            OR employee_has_department_tag(e, 'Drivers')
          ))
        OR (case_stage = 'Billing'
          AND case_dept = 'Accounts'
          AND employee_has_department_tag(e, 'Accounts'))
        OR (case_stage = 'Bill Submission'
          AND case_dept = 'Bill Submission'
          AND employee_has_department_tag(e, 'Bill Submission'))
      )
  );
$$;




--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    department text NOT NULL,
    role text DEFAULT 'employee'::text NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    avatar text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    cases_completed integer DEFAULT 0 NOT NULL,
    cases_active integer DEFAULT 0 NOT NULL,
    join_date date DEFAULT CURRENT_DATE NOT NULL,
    auth_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employee_code text,
    departments jsonb DEFAULT '[]'::jsonb NOT NULL,
    telegram_chat_id text,
    CONSTRAINT employees_department_check CHECK ((department = ANY (ARRAY['Stores'::text, 'Delivery'::text, 'Drivers'::text, 'Scrub Person'::text, 'Cleaning & Audit'::text, 'Checking & Audit'::text, 'Accounts'::text, 'Bill Submission'::text, 'Office Staff'::text, 'Admin'::text]))),
    CONSTRAINT employees_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'employee'::text, 'petrol'::text, 'store_manager'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])))
);


--
-- Name: employee_has_department_tag(public.employees, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.employee_has_department_tag(e public.employees, tag text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT
    e.department = tag
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(e.departments, '[]'::jsonb)) d
      WHERE d = tag
    );
$$;


--
-- Name: employee_is_assignee_on_open_stage(jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.employee_is_assignee_on_open_stage(stages jsonb, emp_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
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


--
-- Name: employee_is_assignee_on_stages(jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.employee_is_assignee_on_stages(stages jsonb, emp_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT emp_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(stages, '[]'::jsonb)) elem
      WHERE elem->'assignedEmployee'->>'id' = emp_id::text
         OR elem->'assistantEmployee'->>'id' = emp_id::text
    );
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT lower(coalesce(auth.jwt()->>'email', '')) IN (
    'jeevanakarsh@gmail.com',
    'jeevan.anishetti@malconnexus.com',
    'preetam.tailam@malconnexus.com'
  );
$$;


--
-- Name: malcon_tms_handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.malcon_tms_handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  profile_count int;
  avatar_colors text[] := array[
    '#0071e3', '#bf5af2', '#ff375f', '#ff9500', '#34c759', '#5e5ce6', '#00a8c5', '#8e8e93'
  ];
  from_admin boolean;
  is_tms boolean;
begin
  is_tms := coalesce(new.raw_user_meta_data ->> 'app', '') = 'malcon_tms';
  if not is_tms then
    return new;
  end if;

  from_admin := coalesce((new.raw_user_meta_data ->> 'created_by_admin')::boolean, false);
  select count(*) into profile_count from public.malcon_tms_profiles;

  if profile_count > 0 and not from_admin then
    raise exception 'Signups are disabled. Ask a workspace admin for an account.';
  end if;

  insert into public.malcon_tms_profiles (id, name, email, role, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    lower(new.email),
    'admin',
    avatar_colors[(profile_count % array_length(avatar_colors, 1)) + 1]
  );

  return new;
end;
$$;


--
-- Name: malcon_tms_workspace_empty(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.malcon_tms_workspace_empty() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select not exists (select 1 from public.malcon_tms_profiles limit 1);
$$;


--
-- Name: save_case_for_session(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.save_case_for_session(p_case jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: employee_food_selections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.employee_food_selections (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    meal_date date NOT NULL,
    breakfast boolean DEFAULT false NOT NULL,
    lunch boolean DEFAULT false NOT NULL,
    dinner boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone
);


--
-- Name: submit_own_food_meals(date, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.submit_own_food_meals(p_meal_date date, p_breakfast boolean, p_lunch boolean, p_dinner boolean) RETURNS public.employee_food_selections
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  emp employees%ROWTYPE;
  result employee_food_selections%ROWTYPE;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO emp
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF emp.id IS NULL THEN
    RAISE EXCEPTION 'Your login is not linked to an employee record. Log out and log in again.';
  END IF;

  IF NOT (COALESCE(p_breakfast, false) OR COALESCE(p_lunch, false) OR COALESCE(p_dinner, false)) THEN
    RAISE EXCEPTION 'Select at least one meal.';
  END IF;

  INSERT INTO employee_food_selections (
    employee_id,
    employee_name,
    meal_date,
    breakfast,
    lunch,
    dinner,
    submitted_at,
    created_at,
    updated_at
  ) VALUES (
    emp.id,
    emp.name,
    p_meal_date,
    COALESCE(p_breakfast, false),
    COALESCE(p_lunch, false),
    COALESCE(p_dinner, false),
    now_ts,
    now_ts,
    now_ts
  )
  ON CONFLICT (employee_id, meal_date) DO UPDATE
  SET
    breakfast = EXCLUDED.breakfast,
    lunch = EXCLUDED.lunch,
    dinner = EXCLUDED.dinner,
    submitted_at = EXCLUDED.submitted_at,
    employee_name = EXCLUDED.employee_name,
    updated_at = EXCLUDED.updated_at
  WHERE employee_food_selections.submitted_at IS NULL
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Meals for this day are already submitted and cannot be changed.';
  END IF;

  RETURN result;
END;
$$;


--
-- Name: submit_own_leave(uuid, text, date, date, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.submit_own_leave(p_id uuid, p_leave_type text, p_from_date date, p_to_date date, p_reason text, p_comp_off_work_date date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    COALESCE(p_id, extensions.uuid_generate_v4()),
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


--
-- Name: sync_case_header_from_stages(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.sync_case_header_from_stages(p_case_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.activity_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    entity_label text DEFAULT ''::text NOT NULL,
    performed_by text NOT NULL,
    performed_by_role text NOT NULL,
    details text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_log_entity_type_check CHECK ((entity_type = ANY (ARRAY['case'::text, 'employee'::text, 'hospital'::text, 'department'::text, 'kit'::text, 'system'::text, 'attendance'::text, 'leave'::text, 'expense'::text, 'petrol'::text]))),
    CONSTRAINT activity_log_performed_by_role_check CHECK ((performed_by_role = ANY (ARRAY['admin'::text, 'employee'::text])))
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.approvals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    case_number text NOT NULL,
    stage text NOT NULL,
    submitted_by text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    status text DEFAULT 'Pending'::text NOT NULL,
    notes text,
    admin_notes text,
    CONSTRAINT approvals_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Changes Requested'::text])))
);


--
-- Name: attendance_approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.attendance_approval_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    punch_type text DEFAULT 'out'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy_m double precision DEFAULT 0 NOT NULL,
    distance_m double precision DEFAULT 0 NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone,
    admin_notes text DEFAULT ''::text NOT NULL,
    attendance_record_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    selfie_url text,
    CONSTRAINT attendance_approval_requests_punch_type_check CHECK ((punch_type = ANY (ARRAY['in'::text, 'out'::text]))),
    CONSTRAINT attendance_approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    punch_type text NOT NULL,
    punched_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy_m double precision DEFAULT 0 NOT NULL,
    distance_m double precision DEFAULT 0 NOT NULL,
    within_office boolean DEFAULT false NOT NULL,
    office_address text DEFAULT 'CCWW+RJ, Hyderabad, Telangana'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    selfie_url text,
    CONSTRAINT attendance_records_punch_type_check CHECK ((punch_type = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: case_alert_escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.case_alert_escalations (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    event_type text NOT NULL,
    alert_1_sent_at timestamp with time zone DEFAULT now() NOT NULL,
    alert_2_sent_at timestamp with time zone,
    alert_3_sent_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_alert_escalations_event_type_check CHECK ((event_type = ANY (ARRAY['assignment'::text, 'postpone'::text])))
);


--
-- Name: case_task_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.case_task_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    case_number text NOT NULL,
    stage text NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    employee_department text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by text,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone,
    admin_notes text,
    CONSTRAINT case_task_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.cases (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    case_number text NOT NULL,
    hospital_id uuid NOT NULL,
    doctor_id uuid,
    hospital_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    doctor_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    surgery_date date,
    implant_required text DEFAULT ''::text NOT NULL,
    implant_type text DEFAULT ''::text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    current_stage text DEFAULT 'Kit Preparation'::text NOT NULL,
    current_department text,
    assigned_employee_id uuid,
    assigned_employee_snapshot jsonb,
    created_by text DEFAULT ''::text NOT NULL,
    due_date date,
    remarks text DEFAULT ''::text NOT NULL,
    stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    activity_logs jsonb DEFAULT '[]'::jsonb NOT NULL,
    comments jsonb DEFAULT '[]'::jsonb NOT NULL,
    invoice_amount numeric(12,2),
    collected_amount numeric(12,2),
    payment_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    implant_company text DEFAULT ''::text NOT NULL,
    cancel_reason text DEFAULT ''::text NOT NULL,
    postpone_reason text DEFAULT ''::text NOT NULL,
    postponed_from date,
    surgery_outcome text DEFAULT ''::text NOT NULL,
    surgery_outcome_detail text DEFAULT ''::text NOT NULL,
    post_surgery_duties jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT cases_current_department_check CHECK (((current_department IS NULL) OR (current_department = ANY (ARRAY['Stores'::text, 'Delivery'::text, 'Drivers'::text, 'Scrub Person'::text, 'Cleaning & Audit'::text, 'Checking & Audit'::text, 'Accounts'::text, 'Bill Submission'::text, 'Office Staff'::text, 'Admin'::text])))),
    CONSTRAINT cases_current_stage_check CHECK ((current_stage = ANY (ARRAY['Set Preparation'::text, 'Kit Preparation'::text, 'Delivery'::text, 'Surgery'::text, 'Pickup from Hospital'::text, 'Cleaning & Audit'::text, 'Checking & Audit'::text, 'Restock'::text, 'Billing'::text, 'Bill Submission'::text, 'Completed'::text]))),
    CONSTRAINT cases_payment_status_check CHECK ((payment_status = ANY (ARRAY['Pending'::text, 'Partial'::text, 'Collected'::text]))),
    CONSTRAINT cases_priority_check CHECK ((priority = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text]))),
    CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Active'::text, 'Waiting For Approval'::text, 'Approved'::text, 'Rejected'::text, 'Changes Requested'::text, 'Completed'::text, 'Cancelled'::text]))),
    CONSTRAINT cases_surgery_outcome_check CHECK ((surgery_outcome = ANY (ARRAY[''::text, 'cancelled'::text, 'parked'::text])))
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    color text DEFAULT 'bg-gray-100 text-gray-800'::text NOT NULL,
    CONSTRAINT departments_name_check CHECK ((name = ANY (ARRAY['Stores'::text, 'Delivery'::text, 'Drivers'::text, 'Scrub Person'::text, 'Cleaning & Audit'::text, 'Checking & Audit'::text, 'Accounts'::text, 'Bill Submission'::text, 'Office Staff'::text, 'Admin'::text])))
);


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.doctors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    specialization text DEFAULT ''::text NOT NULL,
    hospital_id uuid,
    phone text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    doctor_code text
);


--
-- Name: employee_daily_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.employee_daily_expenses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    expense_date date NOT NULL,
    kms_driven numeric DEFAULT 0 NOT NULL,
    petrol_amount numeric DEFAULT 0 NOT NULL,
    food_amount numeric DEFAULT 0 NOT NULL,
    other_amount numeric DEFAULT 0 NOT NULL,
    other_description text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    entered_by text DEFAULT ''::text NOT NULL,
    entered_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_team_attendance_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.field_team_attendance_approvals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    department text DEFAULT ''::text NOT NULL,
    date_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone,
    admin_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_team_attendance_approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: hospital_trip_punches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.hospital_trip_punches (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    hospital_id uuid,
    hospital_name text DEFAULT ''::text NOT NULL,
    punched_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy_m double precision DEFAULT 0 NOT NULL,
    from_latitude double precision,
    from_longitude double precision,
    from_label text DEFAULT ''::text NOT NULL,
    distance_km numeric(10,2) DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.hospitals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    contact_person text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branch text DEFAULT ''::text NOT NULL,
    CONSTRAINT hospitals_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])))
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    leave_type text NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone,
    admin_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comp_off_work_date date,
    CONSTRAINT leave_requests_date_range CHECK ((from_date <= to_date)),
    CONSTRAINT leave_requests_leave_type_check CHECK ((leave_type = ANY (ARRAY['Casual'::text, 'Sick'::text, 'Unpaid'::text, 'Comp Off'::text]))),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: location_trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.location_trips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    trip_no integer NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'started'::text NOT NULL,
    start_at timestamp with time zone DEFAULT now() NOT NULL,
    start_lat double precision NOT NULL,
    start_lng double precision NOT NULL,
    start_accuracy_m double precision DEFAULT 0 NOT NULL,
    end_at timestamp with time zone,
    end_lat double precision,
    end_lng double precision,
    end_accuracy_m double precision,
    distance_km numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_plus_code text DEFAULT ''::text NOT NULL,
    end_plus_code text DEFAULT ''::text NOT NULL,
    bike_km numeric(10,2),
    bike_minutes integer,
    bike_source text DEFAULT ''::text NOT NULL,
    bike_mode text DEFAULT ''::text NOT NULL,
    from_name text DEFAULT ''::text NOT NULL,
    from_address text DEFAULT ''::text NOT NULL,
    from_eloc text DEFAULT ''::text NOT NULL,
    from_lat double precision,
    from_lng double precision,
    hospital_name text DEFAULT ''::text NOT NULL,
    hospital_address text DEFAULT ''::text NOT NULL,
    hospital_eloc text DEFAULT ''::text NOT NULL,
    hospital_lat double precision,
    hospital_lng double precision,
    CONSTRAINT location_trips_status_check CHECK ((status = ANY (ARRAY['started'::text, 'completed'::text])))
);


--
-- Name: login_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.login_otps (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: malcon_tms_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.malcon_tms_activity (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    detail text NOT NULL,
    task_id uuid,
    at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: malcon_tms_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.malcon_tms_profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT malcon_tms_profiles_role_check CHECK ((role = 'admin'::text))
);


--
-- Name: malcon_tms_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.malcon_tms_tasks (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    priority text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    due date,
    assignee_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT malcon_tms_tasks_priority_check CHECK ((priority = ANY (ARRAY['urgent'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT malcon_tms_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'inprogress'::text, 'review'::text, 'done'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    case_id uuid,
    recipient_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: petrol_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.petrol_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text DEFAULT ''::text NOT NULL,
    vehicle_no text DEFAULT ''::text NOT NULL,
    amount numeric(10,2) NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    book_no text DEFAULT ''::text NOT NULL,
    token_no text DEFAULT ''::text NOT NULL,
    issued_by text,
    issued_by_id uuid,
    issued_at timestamp with time zone,
    kms numeric(10,1),
    receipt_url text DEFAULT ''::text NOT NULL,
    receipt_submitted_at timestamp with time zone,
    notes text DEFAULT ''::text NOT NULL,
    admin_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kms_photo_url text DEFAULT ''::text NOT NULL,
    kms_start numeric(10,1),
    kms_end numeric(10,1),
    CONSTRAINT petrol_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT petrol_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'issued'::text, 'receipt_submitted'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: surgical_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.surgical_kits (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    type text DEFAULT ''::text NOT NULL,
    serial_number text NOT NULL,
    status text DEFAULT 'Available'::text NOT NULL,
    last_used_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT surgical_kits_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Assigned'::text, 'In Surgery'::text, 'Cleaning'::text, 'Audit'::text, 'Completed'::text])))
);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'activity_log_pkey' AND n.nspname = 'public' AND t.relname = 'activity_log') THEN
    ALTER TABLE ONLY public.activity_log ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'app_settings_pkey' AND n.nspname = 'public' AND t.relname = 'app_settings') THEN
    ALTER TABLE ONLY public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
  END IF;
END
$do$;


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'approvals_pkey' AND n.nspname = 'public' AND t.relname = 'approvals') THEN
    ALTER TABLE ONLY public.approvals ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: attendance_approval_requests attendance_approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'attendance_approval_requests_pkey' AND n.nspname = 'public' AND t.relname = 'attendance_approval_requests') THEN
    ALTER TABLE ONLY public.attendance_approval_requests ADD CONSTRAINT attendance_approval_requests_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'attendance_records_pkey' AND n.nspname = 'public' AND t.relname = 'attendance_records') THEN
    ALTER TABLE ONLY public.attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: case_alert_escalations case_alert_escalations_case_id_employee_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_alert_escalations DROP CONSTRAINT IF EXISTS "case_alert_escalations_case_id_employee_id_event_type_key";
ALTER TABLE ONLY public.case_alert_escalations
    ADD CONSTRAINT case_alert_escalations_case_id_employee_id_event_type_key UNIQUE (case_id, employee_id, event_type);


--
-- Name: case_alert_escalations case_alert_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'case_alert_escalations_pkey' AND n.nspname = 'public' AND t.relname = 'case_alert_escalations') THEN
    ALTER TABLE ONLY public.case_alert_escalations ADD CONSTRAINT case_alert_escalations_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: case_task_requests case_task_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'case_task_requests_pkey' AND n.nspname = 'public' AND t.relname = 'case_task_requests') THEN
    ALTER TABLE ONLY public.case_task_requests ADD CONSTRAINT case_task_requests_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: cases cases_case_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases DROP CONSTRAINT IF EXISTS "cases_case_number_key";
ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_case_number_key UNIQUE (case_number);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'cases_pkey' AND n.nspname = 'public' AND t.relname = 'cases') THEN
    ALTER TABLE ONLY public.cases ADD CONSTRAINT cases_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments DROP CONSTRAINT IF EXISTS "departments_name_key";
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'departments_pkey' AND n.nspname = 'public' AND t.relname = 'departments') THEN
    ALTER TABLE ONLY public.departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'doctors_pkey' AND n.nspname = 'public' AND t.relname = 'doctors') THEN
    ALTER TABLE ONLY public.doctors ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: employee_daily_expenses employee_daily_expenses_one_per_day; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_daily_expenses DROP CONSTRAINT IF EXISTS "employee_daily_expenses_one_per_day";
ALTER TABLE ONLY public.employee_daily_expenses
    ADD CONSTRAINT employee_daily_expenses_one_per_day UNIQUE (employee_id, expense_date);


--
-- Name: employee_daily_expenses employee_daily_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'employee_daily_expenses_pkey' AND n.nspname = 'public' AND t.relname = 'employee_daily_expenses') THEN
    ALTER TABLE ONLY public.employee_daily_expenses ADD CONSTRAINT employee_daily_expenses_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: employee_food_selections employee_food_one_per_day; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_food_selections DROP CONSTRAINT IF EXISTS "employee_food_one_per_day";
ALTER TABLE ONLY public.employee_food_selections
    ADD CONSTRAINT employee_food_one_per_day UNIQUE (employee_id, meal_date);


--
-- Name: employee_food_selections employee_food_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'employee_food_selections_pkey' AND n.nspname = 'public' AND t.relname = 'employee_food_selections') THEN
    ALTER TABLE ONLY public.employee_food_selections ADD CONSTRAINT employee_food_selections_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees DROP CONSTRAINT IF EXISTS "employees_email_key";
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'employees_pkey' AND n.nspname = 'public' AND t.relname = 'employees') THEN
    ALTER TABLE ONLY public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: field_team_attendance_approvals field_team_attendance_approvals_employee_id_date_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_team_attendance_approvals DROP CONSTRAINT IF EXISTS "field_team_attendance_approvals_employee_id_date_key_key";
ALTER TABLE ONLY public.field_team_attendance_approvals
    ADD CONSTRAINT field_team_attendance_approvals_employee_id_date_key_key UNIQUE (employee_id, date_key);


--
-- Name: field_team_attendance_approvals field_team_attendance_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'field_team_attendance_approvals_pkey' AND n.nspname = 'public' AND t.relname = 'field_team_attendance_approvals') THEN
    ALTER TABLE ONLY public.field_team_attendance_approvals ADD CONSTRAINT field_team_attendance_approvals_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: hospital_trip_punches hospital_trip_punches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'hospital_trip_punches_pkey' AND n.nspname = 'public' AND t.relname = 'hospital_trip_punches') THEN
    ALTER TABLE ONLY public.hospital_trip_punches ADD CONSTRAINT hospital_trip_punches_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'hospitals_pkey' AND n.nspname = 'public' AND t.relname = 'hospitals') THEN
    ALTER TABLE ONLY public.hospitals ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'leave_requests_pkey' AND n.nspname = 'public' AND t.relname = 'leave_requests') THEN
    ALTER TABLE ONLY public.leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: location_trips location_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'location_trips_pkey' AND n.nspname = 'public' AND t.relname = 'location_trips') THEN
    ALTER TABLE ONLY public.location_trips ADD CONSTRAINT location_trips_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: login_otps login_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'login_otps_pkey' AND n.nspname = 'public' AND t.relname = 'login_otps') THEN
    ALTER TABLE ONLY public.login_otps ADD CONSTRAINT login_otps_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: malcon_tms_activity malcon_tms_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'malcon_tms_activity_pkey' AND n.nspname = 'public' AND t.relname = 'malcon_tms_activity') THEN
    ALTER TABLE ONLY public.malcon_tms_activity ADD CONSTRAINT malcon_tms_activity_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: malcon_tms_profiles malcon_tms_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malcon_tms_profiles DROP CONSTRAINT IF EXISTS "malcon_tms_profiles_email_key";
ALTER TABLE ONLY public.malcon_tms_profiles
    ADD CONSTRAINT malcon_tms_profiles_email_key UNIQUE (email);


--
-- Name: malcon_tms_profiles malcon_tms_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'malcon_tms_profiles_pkey' AND n.nspname = 'public' AND t.relname = 'malcon_tms_profiles') THEN
    ALTER TABLE ONLY public.malcon_tms_profiles ADD CONSTRAINT malcon_tms_profiles_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: malcon_tms_tasks malcon_tms_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'malcon_tms_tasks_pkey' AND n.nspname = 'public' AND t.relname = 'malcon_tms_tasks') THEN
    ALTER TABLE ONLY public.malcon_tms_tasks ADD CONSTRAINT malcon_tms_tasks_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'notifications_pkey' AND n.nspname = 'public' AND t.relname = 'notifications') THEN
    ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: petrol_requests petrol_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'petrol_requests_pkey' AND n.nspname = 'public' AND t.relname = 'petrol_requests') THEN
    ALTER TABLE ONLY public.petrol_requests ADD CONSTRAINT petrol_requests_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions DROP CONSTRAINT IF EXISTS "push_subscriptions_endpoint_key";
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'push_subscriptions_pkey' AND n.nspname = 'public' AND t.relname = 'push_subscriptions') THEN
    ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: surgical_kits surgical_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = 'surgical_kits_pkey' AND n.nspname = 'public' AND t.relname = 'surgical_kits') THEN
    ALTER TABLE ONLY public.surgical_kits ADD CONSTRAINT surgical_kits_pkey PRIMARY KEY (id);
  END IF;
END
$do$;


--
-- Name: surgical_kits surgical_kits_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgical_kits DROP CONSTRAINT IF EXISTS "surgical_kits_serial_number_key";
ALTER TABLE ONLY public.surgical_kits
    ADD CONSTRAINT surgical_kits_serial_number_key UNIQUE (serial_number);


--
-- Name: idx_activity_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log USING btree (created_at DESC);


--
-- Name: idx_activity_log_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON public.activity_log USING btree (entity_type);


--
-- Name: idx_approvals_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approvals_case_id ON public.approvals USING btree (case_id);


--
-- Name: idx_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals USING btree (status);


--
-- Name: idx_attendance_approval_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_attendance_approval_employee_id ON public.attendance_approval_requests USING btree (employee_id);


--
-- Name: idx_attendance_approval_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_attendance_approval_requested_at ON public.attendance_approval_requests USING btree (requested_at DESC);


--
-- Name: idx_attendance_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_attendance_approval_status ON public.attendance_approval_requests USING btree (status);


--
-- Name: idx_attendance_employee_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_attendance_employee_day ON public.attendance_records USING btree (employee_id, punched_at DESC);


--
-- Name: idx_attendance_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance_records USING btree (employee_id);


--
-- Name: idx_attendance_punched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_attendance_punched_at ON public.attendance_records USING btree (punched_at DESC);


--
-- Name: idx_case_alert_escalations_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_case_alert_escalations_pending ON public.case_alert_escalations USING btree (alert_1_sent_at) WHERE ((acknowledged_at IS NULL) AND (alert_3_sent_at IS NULL));


--
-- Name: idx_case_task_requests_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_case_task_requests_case_id ON public.case_task_requests USING btree (case_id);


--
-- Name: idx_case_task_requests_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_case_task_requests_employee_id ON public.case_task_requests USING btree (employee_id);


--
-- Name: idx_case_task_requests_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_task_requests_one_pending ON public.case_task_requests USING btree (case_id, employee_id) WHERE (status = 'pending'::text);


--
-- Name: idx_case_task_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_case_task_requests_status ON public.case_task_requests USING btree (status);


--
-- Name: idx_cases_assigned_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_assigned_employee ON public.cases USING btree (assigned_employee_id);


--
-- Name: idx_cases_current_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_current_stage ON public.cases USING btree (current_stage);


--
-- Name: idx_cases_hospital_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_hospital_id ON public.cases USING btree (hospital_id);


--
-- Name: idx_cases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases USING btree (status);


--
-- Name: idx_cases_surgery_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_surgery_date ON public.cases USING btree (surgery_date);


--
-- Name: idx_doctors_doctor_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_doctor_code ON public.doctors USING btree (doctor_code) WHERE ((doctor_code IS NOT NULL) AND (doctor_code <> ''::text));


--
-- Name: idx_doctors_hospital_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_doctors_hospital_id ON public.doctors USING btree (hospital_id);


--
-- Name: idx_employees_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON public.employees USING btree (auth_user_id);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_employee_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_code ON public.employees USING btree (employee_code) WHERE ((employee_code IS NOT NULL) AND (employee_code <> ''::text));


--
-- Name: idx_employees_telegram_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_employees_telegram_chat_id ON public.employees USING btree (telegram_chat_id) WHERE ((telegram_chat_id IS NOT NULL) AND (telegram_chat_id <> ''::text));


--
-- Name: idx_expenses_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_expenses_employee_id ON public.employee_daily_expenses USING btree (employee_id);


--
-- Name: idx_expenses_expense_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.employee_daily_expenses USING btree (expense_date DESC);


--
-- Name: idx_field_team_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_field_team_attendance_date ON public.field_team_attendance_approvals USING btree (date_key DESC);


--
-- Name: idx_field_team_attendance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_field_team_attendance_status ON public.field_team_attendance_approvals USING btree (status);


--
-- Name: idx_food_selections_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_food_selections_employee_id ON public.employee_food_selections USING btree (employee_id);


--
-- Name: idx_food_selections_meal_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_food_selections_meal_date ON public.employee_food_selections USING btree (meal_date DESC);


--
-- Name: idx_hospital_trip_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_hospital_trip_employee_id ON public.hospital_trip_punches USING btree (employee_id);


--
-- Name: idx_hospital_trip_punched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_hospital_trip_punched_at ON public.hospital_trip_punches USING btree (punched_at DESC);


--
-- Name: idx_hospitals_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON public.hospitals USING btree (city);


--
-- Name: idx_leave_requests_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_from_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_leave_requests_from_date ON public.leave_requests USING btree (from_date);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_requests_to_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_leave_requests_to_date ON public.leave_requests USING btree (to_date);


--
-- Name: idx_location_trips_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_location_trips_employee_id ON public.location_trips USING btree (employee_id);


--
-- Name: idx_location_trips_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_trips_one_open ON public.location_trips USING btree (employee_id) WHERE (status = 'started'::text);


--
-- Name: idx_location_trips_start_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_location_trips_start_at ON public.location_trips USING btree (start_at DESC);


--
-- Name: idx_login_otps_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_otps_active ON public.login_otps USING btree (employee_id, expires_at) WHERE (consumed_at IS NULL);


--
-- Name: idx_login_otps_employee_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_otps_employee_created ON public.login_otps USING btree (employee_id, created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications USING btree (recipient_id);


--
-- Name: idx_petrol_book_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_petrol_book_token ON public.petrol_requests USING btree (book_no, token_no) WHERE ((book_no <> ''::text) AND (token_no <> ''::text));


--
-- Name: idx_petrol_requests_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_petrol_requests_employee_id ON public.petrol_requests USING btree (employee_id);


--
-- Name: idx_petrol_requests_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_petrol_requests_requested_at ON public.petrol_requests USING btree (requested_at DESC);


--
-- Name: idx_petrol_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_petrol_requests_status ON public.petrol_requests USING btree (status);


--
-- Name: idx_push_subscriptions_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee ON public.push_subscriptions USING btree (employee_id);


--
-- Name: malcon_tms_activity_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS malcon_tms_activity_at_idx ON public.malcon_tms_activity USING btree (at DESC);


--
-- Name: malcon_tms_tasks_assignee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS malcon_tms_tasks_assignee_idx ON public.malcon_tms_tasks USING btree (assignee_id);


--
-- Name: malcon_tms_tasks_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS malcon_tms_tasks_status_idx ON public.malcon_tms_tasks USING btree (status);


--
-- Name: cases set_updated_at_cases; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS "set_updated_at_cases" ON public.cases;
CREATE TRIGGER set_updated_at_cases BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employees set_updated_at_employees; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS "set_updated_at_employees" ON public.employees;
CREATE TRIGGER set_updated_at_employees BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: hospitals set_updated_at_hospitals; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS "set_updated_at_hospitals" ON public.hospitals;
CREATE TRIGGER set_updated_at_hospitals BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: surgical_kits set_updated_at_kits; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS "set_updated_at_kits" ON public.surgical_kits;
CREATE TRIGGER set_updated_at_kits BEFORE UPDATE ON public.surgical_kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: location_trips set_updated_at_location_trips; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS "set_updated_at_location_trips" ON public.location_trips;
CREATE TRIGGER set_updated_at_location_trips BEFORE UPDATE ON public.location_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: petrol_requests set_updated_at_petrol; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS "set_updated_at_petrol" ON public.petrol_requests;
CREATE TRIGGER set_updated_at_petrol BEFORE UPDATE ON public.petrol_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: approvals approvals_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals DROP CONSTRAINT IF EXISTS "approvals_case_id_fkey";
ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: attendance_approval_requests attendance_approval_requests_attendance_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_approval_requests DROP CONSTRAINT IF EXISTS "attendance_approval_requests_attendance_record_id_fkey";
ALTER TABLE ONLY public.attendance_approval_requests
    ADD CONSTRAINT attendance_approval_requests_attendance_record_id_fkey FOREIGN KEY (attendance_record_id) REFERENCES public.attendance_records(id) ON DELETE SET NULL;


--
-- Name: attendance_approval_requests attendance_approval_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_approval_requests DROP CONSTRAINT IF EXISTS "attendance_approval_requests_employee_id_fkey";
ALTER TABLE ONLY public.attendance_approval_requests
    ADD CONSTRAINT attendance_approval_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance_approval_requests attendance_approval_requests_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_approval_requests DROP CONSTRAINT IF EXISTS "attendance_approval_requests_reviewed_by_id_fkey";
ALTER TABLE ONLY public.attendance_approval_requests
    ADD CONSTRAINT attendance_approval_requests_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: attendance_records attendance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records DROP CONSTRAINT IF EXISTS "attendance_records_employee_id_fkey";
ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: case_alert_escalations case_alert_escalations_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_alert_escalations DROP CONSTRAINT IF EXISTS "case_alert_escalations_case_id_fkey";
ALTER TABLE ONLY public.case_alert_escalations
    ADD CONSTRAINT case_alert_escalations_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_alert_escalations case_alert_escalations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_alert_escalations DROP CONSTRAINT IF EXISTS "case_alert_escalations_employee_id_fkey";
ALTER TABLE ONLY public.case_alert_escalations
    ADD CONSTRAINT case_alert_escalations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: case_task_requests case_task_requests_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_task_requests DROP CONSTRAINT IF EXISTS "case_task_requests_case_id_fkey";
ALTER TABLE ONLY public.case_task_requests
    ADD CONSTRAINT case_task_requests_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_task_requests case_task_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_task_requests DROP CONSTRAINT IF EXISTS "case_task_requests_employee_id_fkey";
ALTER TABLE ONLY public.case_task_requests
    ADD CONSTRAINT case_task_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: case_task_requests case_task_requests_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_task_requests DROP CONSTRAINT IF EXISTS "case_task_requests_reviewed_by_id_fkey";
ALTER TABLE ONLY public.case_task_requests
    ADD CONSTRAINT case_task_requests_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: cases cases_assigned_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases DROP CONSTRAINT IF EXISTS "cases_assigned_employee_id_fkey";
ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_assigned_employee_id_fkey FOREIGN KEY (assigned_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: cases cases_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases DROP CONSTRAINT IF EXISTS "cases_doctor_id_fkey";
ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;


--
-- Name: cases cases_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases DROP CONSTRAINT IF EXISTS "cases_hospital_id_fkey";
ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE RESTRICT;


--
-- Name: doctors doctors_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors DROP CONSTRAINT IF EXISTS "doctors_hospital_id_fkey";
ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE SET NULL;


--
-- Name: employee_daily_expenses employee_daily_expenses_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_daily_expenses DROP CONSTRAINT IF EXISTS "employee_daily_expenses_employee_id_fkey";
ALTER TABLE ONLY public.employee_daily_expenses
    ADD CONSTRAINT employee_daily_expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_daily_expenses employee_daily_expenses_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_daily_expenses DROP CONSTRAINT IF EXISTS "employee_daily_expenses_entered_by_id_fkey";
ALTER TABLE ONLY public.employee_daily_expenses
    ADD CONSTRAINT employee_daily_expenses_entered_by_id_fkey FOREIGN KEY (entered_by_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: employee_food_selections employee_food_selections_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_food_selections DROP CONSTRAINT IF EXISTS "employee_food_selections_employee_id_fkey";
ALTER TABLE ONLY public.employee_food_selections
    ADD CONSTRAINT employee_food_selections_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees DROP CONSTRAINT IF EXISTS "employees_auth_user_id_fkey";
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: field_team_attendance_approvals field_team_attendance_approvals_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_team_attendance_approvals DROP CONSTRAINT IF EXISTS "field_team_attendance_approvals_employee_id_fkey";
ALTER TABLE ONLY public.field_team_attendance_approvals
    ADD CONSTRAINT field_team_attendance_approvals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: field_team_attendance_approvals field_team_attendance_approvals_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_team_attendance_approvals DROP CONSTRAINT IF EXISTS "field_team_attendance_approvals_reviewed_by_id_fkey";
ALTER TABLE ONLY public.field_team_attendance_approvals
    ADD CONSTRAINT field_team_attendance_approvals_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: hospital_trip_punches hospital_trip_punches_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_trip_punches DROP CONSTRAINT IF EXISTS "hospital_trip_punches_employee_id_fkey";
ALTER TABLE ONLY public.hospital_trip_punches
    ADD CONSTRAINT hospital_trip_punches_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hospital_trip_punches hospital_trip_punches_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_trip_punches DROP CONSTRAINT IF EXISTS "hospital_trip_punches_hospital_id_fkey";
ALTER TABLE ONLY public.hospital_trip_punches
    ADD CONSTRAINT hospital_trip_punches_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests DROP CONSTRAINT IF EXISTS "leave_requests_employee_id_fkey";
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests DROP CONSTRAINT IF EXISTS "leave_requests_reviewed_by_id_fkey";
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: location_trips location_trips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_trips DROP CONSTRAINT IF EXISTS "location_trips_employee_id_fkey";
ALTER TABLE ONLY public.location_trips
    ADD CONSTRAINT location_trips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: login_otps login_otps_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_otps DROP CONSTRAINT IF EXISTS "login_otps_employee_id_fkey";
ALTER TABLE ONLY public.login_otps
    ADD CONSTRAINT login_otps_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: malcon_tms_activity malcon_tms_activity_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malcon_tms_activity DROP CONSTRAINT IF EXISTS "malcon_tms_activity_task_id_fkey";
ALTER TABLE ONLY public.malcon_tms_activity
    ADD CONSTRAINT malcon_tms_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.malcon_tms_tasks(id) ON DELETE SET NULL;


--
-- Name: malcon_tms_activity malcon_tms_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malcon_tms_activity DROP CONSTRAINT IF EXISTS "malcon_tms_activity_user_id_fkey";
ALTER TABLE ONLY public.malcon_tms_activity
    ADD CONSTRAINT malcon_tms_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.malcon_tms_profiles(id) ON DELETE CASCADE;


--
-- Name: malcon_tms_profiles malcon_tms_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malcon_tms_profiles DROP CONSTRAINT IF EXISTS "malcon_tms_profiles_id_fkey";
ALTER TABLE ONLY public.malcon_tms_profiles
    ADD CONSTRAINT malcon_tms_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: malcon_tms_tasks malcon_tms_tasks_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malcon_tms_tasks DROP CONSTRAINT IF EXISTS "malcon_tms_tasks_assignee_id_fkey";
ALTER TABLE ONLY public.malcon_tms_tasks
    ADD CONSTRAINT malcon_tms_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.malcon_tms_profiles(id) ON DELETE SET NULL;


--
-- Name: malcon_tms_tasks malcon_tms_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malcon_tms_tasks DROP CONSTRAINT IF EXISTS "malcon_tms_tasks_created_by_fkey";
ALTER TABLE ONLY public.malcon_tms_tasks
    ADD CONSTRAINT malcon_tms_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.malcon_tms_profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications DROP CONSTRAINT IF EXISTS "notifications_case_id_fkey";
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications DROP CONSTRAINT IF EXISTS "notifications_recipient_id_fkey";
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: petrol_requests petrol_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petrol_requests DROP CONSTRAINT IF EXISTS "petrol_requests_employee_id_fkey";
ALTER TABLE ONLY public.petrol_requests
    ADD CONSTRAINT petrol_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: petrol_requests petrol_requests_issued_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petrol_requests DROP CONSTRAINT IF EXISTS "petrol_requests_issued_by_id_fkey";
ALTER TABLE ONLY public.petrol_requests
    ADD CONSTRAINT petrol_requests_issued_by_id_fkey FOREIGN KEY (issued_by_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions DROP CONSTRAINT IF EXISTS "push_subscriptions_employee_id_fkey";
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "activity_admin_all" ON public.activity_log;
CREATE POLICY activity_admin_all ON public.activity_log USING ((public.current_user_role() = 'admin'::text));


--
-- Name: activity_log activity_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "activity_employee_insert" ON public.activity_log;
CREATE POLICY activity_employee_insert ON public.activity_log FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: activity_log activity_employee_read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "activity_employee_read" ON public.activity_log;
CREATE POLICY activity_employee_read ON public.activity_log FOR SELECT USING ((public.current_user_role() = 'employee'::text));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_log activity_store_manager_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "activity_store_manager_all" ON public.activity_log;
CREATE POLICY activity_store_manager_all ON public.activity_log USING ((public.current_user_role() = 'store_manager'::text));


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings app_settings_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;
CREATE POLICY app_settings_admin_all ON public.app_settings USING ((public.current_user_role() = 'admin'::text));


--
-- Name: app_settings app_settings_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "app_settings_authenticated_select" ON public.app_settings;
CREATE POLICY app_settings_authenticated_select ON public.app_settings FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals approvals_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "approvals_admin_all" ON public.approvals;
CREATE POLICY approvals_admin_all ON public.approvals USING ((public.current_user_role() = 'admin'::text));


--
-- Name: approvals approvals_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "approvals_employee_insert" ON public.approvals;
CREATE POLICY approvals_employee_insert ON public.approvals FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = approvals.case_id) AND (cases.assigned_employee_id = public.current_employee_id())))));


--
-- Name: approvals approvals_employee_read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "approvals_employee_read" ON public.approvals;
CREATE POLICY approvals_employee_read ON public.approvals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = approvals.case_id) AND (cases.assigned_employee_id = public.current_employee_id())))));


--
-- Name: approvals approvals_store_manager_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "approvals_store_manager_all" ON public.approvals;
CREATE POLICY approvals_store_manager_all ON public.approvals USING ((public.current_user_role() = 'store_manager'::text));


--
-- Name: attendance_records attendance_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_admin_all" ON public.attendance_records;
CREATE POLICY attendance_admin_all ON public.attendance_records USING ((public.current_user_role() = 'admin'::text));


--
-- Name: attendance_approval_requests attendance_approval_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_approval_admin_all" ON public.attendance_approval_requests;
CREATE POLICY attendance_approval_admin_all ON public.attendance_approval_requests USING ((public.current_user_role() = 'admin'::text));


--
-- Name: attendance_approval_requests attendance_approval_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_approval_employee_insert" ON public.attendance_approval_requests;
CREATE POLICY attendance_approval_employee_insert ON public.attendance_approval_requests FOR INSERT WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'pending'::text)));


--
-- Name: attendance_approval_requests attendance_approval_employee_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_approval_employee_own" ON public.attendance_approval_requests;
CREATE POLICY attendance_approval_employee_own ON public.attendance_approval_requests FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: attendance_approval_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_approval_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_approval_requests attendance_approval_store_manager_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_approval_store_manager_select" ON public.attendance_approval_requests;
CREATE POLICY attendance_approval_store_manager_select ON public.attendance_approval_requests FOR SELECT USING ((public.current_user_role() = 'store_manager'::text));


--
-- Name: attendance_records attendance_employee_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_employee_own" ON public.attendance_records;
CREATE POLICY attendance_employee_own ON public.attendance_records USING ((employee_id = public.current_employee_id())) WITH CHECK ((employee_id = public.current_employee_id()));


--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records attendance_store_manager_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "attendance_store_manager_all" ON public.attendance_records;
CREATE POLICY attendance_store_manager_all ON public.attendance_records USING ((public.current_user_role() = 'store_manager'::text));


--
-- Name: case_alert_escalations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_alert_escalations ENABLE ROW LEVEL SECURITY;

--
-- Name: case_alert_escalations case_alert_escalations_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "case_alert_escalations_admin_all" ON public.case_alert_escalations;
CREATE POLICY case_alert_escalations_admin_all ON public.case_alert_escalations USING ((public.current_user_role() = 'admin'::text));


--
-- Name: case_alert_escalations case_alert_escalations_employee_read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "case_alert_escalations_employee_read" ON public.case_alert_escalations;
CREATE POLICY case_alert_escalations_employee_read ON public.case_alert_escalations FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: case_task_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_task_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: case_task_requests case_task_requests_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "case_task_requests_admin_all" ON public.case_task_requests;
CREATE POLICY case_task_requests_admin_all ON public.case_task_requests USING ((public.current_user_role() = 'admin'::text));


--
-- Name: case_task_requests case_task_requests_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "case_task_requests_employee_insert" ON public.case_task_requests;
CREATE POLICY case_task_requests_employee_insert ON public.case_task_requests FOR INSERT WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.cases c
  WHERE ((c.id = case_task_requests.case_id) AND (c.assigned_employee_id IS NULL) AND (c.status = ANY (ARRAY['Active'::text, 'Draft'::text])) AND (c.current_stage = ANY (ARRAY['Pickup from Hospital'::text, 'Billing'::text, 'Bill Submission'::text])) AND public.employee_can_claim_fcfs_case(c.current_stage, c.current_department))))));


--
-- Name: case_task_requests case_task_requests_employee_read_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "case_task_requests_employee_read_own" ON public.case_task_requests;
CREATE POLICY case_task_requests_employee_read_own ON public.case_task_requests FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: cases cases_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "cases_admin_all" ON public.cases;
CREATE POLICY cases_admin_all ON public.cases USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'store_manager'::text])));


--
-- Name: cases cases_employee_assigned; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "cases_employee_assigned" ON public.cases;
CREATE POLICY cases_employee_assigned ON public.cases FOR SELECT USING (((assigned_employee_id = public.current_employee_id()) OR public.employee_is_assignee_on_open_stage(stages, public.current_employee_id()) OR (EXISTS ( SELECT 1
   FROM jsonb_array_elements(COALESCE(cases.stages, '[]'::jsonb)) elem(value)
  WHERE ((((elem.value -> 'assistantEmployee'::text) ->> 'id'::text) = (public.current_employee_id())::text) AND ((elem.value ->> 'stage'::text) = cases.current_stage))))));


--
-- Name: cases cases_employee_fcfs_pool; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "cases_employee_fcfs_pool" ON public.cases;
CREATE POLICY cases_employee_fcfs_pool ON public.cases FOR SELECT USING (((assigned_employee_id IS NULL) AND (status = ANY (ARRAY['Active'::text, 'Draft'::text])) AND (current_stage = ANY (ARRAY['Pickup from Hospital'::text, 'Billing'::text, 'Bill Submission'::text])) AND public.employee_can_claim_fcfs_case(current_stage, current_department)));


--
-- Name: cases cases_employee_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "cases_employee_update" ON public.cases;
CREATE POLICY cases_employee_update ON public.cases FOR UPDATE USING (((assigned_employee_id = public.current_employee_id()) OR public.employee_is_assignee_on_open_stage(stages, public.current_employee_id()))) WITH CHECK (true);


--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: departments departments_read_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "departments_read_all" ON public.departments;
CREATE POLICY departments_read_all ON public.departments FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: doctors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

--
-- Name: doctors doctors_admin_write; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "doctors_admin_write" ON public.doctors;
CREATE POLICY doctors_admin_write ON public.doctors USING ((public.current_user_role() = 'admin'::text));


--
-- Name: doctors doctors_read_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "doctors_read_all" ON public.doctors;
CREATE POLICY doctors_read_all ON public.doctors FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: doctors doctors_store_manager_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "doctors_store_manager_insert" ON public.doctors;
CREATE POLICY doctors_store_manager_insert ON public.doctors FOR INSERT WITH CHECK ((public.current_user_role() = 'store_manager'::text));


--
-- Name: employee_daily_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_daily_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_food_selections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_food_selections ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_admin_all" ON public.employees;
CREATE POLICY employees_admin_all ON public.employees USING ((public.current_user_role() = 'admin'::text));


--
-- Name: employees employees_petrol_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_petrol_insert" ON public.employees;
CREATE POLICY employees_petrol_insert ON public.employees FOR INSERT WITH CHECK (((public.current_user_role() = ANY (ARRAY['admin'::text, 'petrol'::text])) AND (role = 'employee'::text)));


--
-- Name: employees employees_petrol_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_petrol_select" ON public.employees;
CREATE POLICY employees_petrol_select ON public.employees FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'petrol'::text])));


--
-- Name: employees employees_self_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_self_select" ON public.employees;
CREATE POLICY employees_self_select ON public.employees FOR SELECT USING ((auth_user_id = auth.uid()));


--
-- Name: employees employees_self_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_self_update" ON public.employees;
CREATE POLICY employees_self_update ON public.employees FOR UPDATE USING ((auth_user_id = auth.uid()));


--
-- Name: employees employees_store_manager_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_store_manager_select" ON public.employees;
CREATE POLICY employees_store_manager_select ON public.employees FOR SELECT USING ((public.current_user_role() = 'store_manager'::text));


--
-- Name: employees employees_store_manager_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "employees_store_manager_update" ON public.employees;
CREATE POLICY employees_store_manager_update ON public.employees FOR UPDATE USING ((public.current_user_role() = 'store_manager'::text)) WITH CHECK ((public.current_user_role() = 'store_manager'::text));


--
-- Name: employee_daily_expenses expenses_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "expenses_admin_all" ON public.employee_daily_expenses;
CREATE POLICY expenses_admin_all ON public.employee_daily_expenses USING ((public.current_user_role() = 'admin'::text));


--
-- Name: field_team_attendance_approvals field_team_attendance_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "field_team_attendance_admin_all" ON public.field_team_attendance_approvals;
CREATE POLICY field_team_attendance_admin_all ON public.field_team_attendance_approvals USING ((public.current_user_role() = 'admin'::text));


--
-- Name: field_team_attendance_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_team_attendance_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: field_team_attendance_approvals field_team_attendance_employee_read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "field_team_attendance_employee_read" ON public.field_team_attendance_approvals;
CREATE POLICY field_team_attendance_employee_read ON public.field_team_attendance_approvals FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: employee_food_selections food_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "food_admin_all" ON public.employee_food_selections;
CREATE POLICY food_admin_all ON public.employee_food_selections USING ((public.current_user_role() = 'admin'::text));


--
-- Name: employee_food_selections food_employee_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "food_employee_select" ON public.employee_food_selections;
CREATE POLICY food_employee_select ON public.employee_food_selections FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: hospital_trip_punches hospital_trip_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "hospital_trip_admin_all" ON public.hospital_trip_punches;
CREATE POLICY hospital_trip_admin_all ON public.hospital_trip_punches USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'petrol'::text])));


--
-- Name: hospital_trip_punches hospital_trip_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "hospital_trip_employee_insert" ON public.hospital_trip_punches;
CREATE POLICY hospital_trip_employee_insert ON public.hospital_trip_punches FOR INSERT WITH CHECK ((employee_id = public.current_employee_id()));


--
-- Name: hospital_trip_punches hospital_trip_employee_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "hospital_trip_employee_select" ON public.hospital_trip_punches;
CREATE POLICY hospital_trip_employee_select ON public.hospital_trip_punches FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: hospital_trip_punches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hospital_trip_punches ENABLE ROW LEVEL SECURITY;

--
-- Name: hospitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

--
-- Name: hospitals hospitals_admin_write; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "hospitals_admin_write" ON public.hospitals;
CREATE POLICY hospitals_admin_write ON public.hospitals USING ((public.current_user_role() = 'admin'::text));


--
-- Name: hospitals hospitals_read_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "hospitals_read_all" ON public.hospitals;
CREATE POLICY hospitals_read_all ON public.hospitals FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: surgical_kits kits_admin_write; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "kits_admin_write" ON public.surgical_kits;
CREATE POLICY kits_admin_write ON public.surgical_kits USING ((public.current_user_role() = 'admin'::text));


--
-- Name: surgical_kits kits_read_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "kits_read_all" ON public.surgical_kits;
CREATE POLICY kits_read_all ON public.surgical_kits FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: leave_requests leave_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "leave_admin_all" ON public.leave_requests;
CREATE POLICY leave_admin_all ON public.leave_requests USING ((public.current_user_role() = 'admin'::text));


--
-- Name: leave_requests leave_employee_cancel; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "leave_employee_cancel" ON public.leave_requests;
CREATE POLICY leave_employee_cancel ON public.leave_requests FOR UPDATE USING (((employee_id = public.current_employee_id()) AND (status = 'pending'::text))) WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'cancelled'::text)));


--
-- Name: leave_requests leave_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "leave_employee_insert" ON public.leave_requests;
CREATE POLICY leave_employee_insert ON public.leave_requests FOR INSERT WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'pending'::text)));


--
-- Name: leave_requests leave_employee_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "leave_employee_select" ON public.leave_requests;
CREATE POLICY leave_employee_select ON public.leave_requests FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests leave_store_manager_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "leave_store_manager_all" ON public.leave_requests;
CREATE POLICY leave_store_manager_all ON public.leave_requests USING ((public.current_user_role() = 'store_manager'::text));


--
-- Name: location_trips location_trip_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "location_trip_admin_all" ON public.location_trips;
CREATE POLICY location_trip_admin_all ON public.location_trips USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'petrol'::text])));


--
-- Name: location_trips location_trip_employee_complete; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "location_trip_employee_complete" ON public.location_trips;
CREATE POLICY location_trip_employee_complete ON public.location_trips FOR UPDATE USING (((employee_id = public.current_employee_id()) AND (status = 'started'::text))) WITH CHECK (((employee_id = public.current_employee_id()) AND (status = ANY (ARRAY['started'::text, 'completed'::text]))));


--
-- Name: location_trips location_trip_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "location_trip_employee_insert" ON public.location_trips;
CREATE POLICY location_trip_employee_insert ON public.location_trips FOR INSERT WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'started'::text)));


--
-- Name: location_trips location_trip_employee_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "location_trip_employee_select" ON public.location_trips;
CREATE POLICY location_trip_employee_select ON public.location_trips FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: location_trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_trips ENABLE ROW LEVEL SECURITY;

--
-- Name: login_otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;

--
-- Name: malcon_tms_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.malcon_tms_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: malcon_tms_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.malcon_tms_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: malcon_tms_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.malcon_tms_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;
CREATE POLICY notifications_admin_all ON public.notifications USING ((public.current_user_role() = 'admin'::text));


--
-- Name: notifications notifications_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY notifications_own ON public.notifications USING ((recipient_id = public.current_employee_id()));


--
-- Name: petrol_requests petrol_admin_all; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "petrol_admin_all" ON public.petrol_requests;
CREATE POLICY petrol_admin_all ON public.petrol_requests USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'petrol'::text])));


--
-- Name: petrol_requests petrol_employee_cancel; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "petrol_employee_cancel" ON public.petrol_requests;
CREATE POLICY petrol_employee_cancel ON public.petrol_requests FOR UPDATE USING (((employee_id = public.current_employee_id()) AND (status = 'pending'::text))) WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'cancelled'::text)));


--
-- Name: petrol_requests petrol_employee_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "petrol_employee_insert" ON public.petrol_requests;
CREATE POLICY petrol_employee_insert ON public.petrol_requests FOR INSERT WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'pending'::text)));


--
-- Name: petrol_requests petrol_employee_receipt; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "petrol_employee_receipt" ON public.petrol_requests;
CREATE POLICY petrol_employee_receipt ON public.petrol_requests FOR UPDATE USING (((employee_id = public.current_employee_id()) AND (status = 'issued'::text))) WITH CHECK (((employee_id = public.current_employee_id()) AND (status = 'receipt_submitted'::text)));


--
-- Name: petrol_requests petrol_employee_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "petrol_employee_select" ON public.petrol_requests;
CREATE POLICY petrol_employee_select ON public.petrol_requests FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: petrol_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.petrol_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subscriptions_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR SELECT USING ((employee_id = public.current_employee_id()));


--
-- Name: surgical_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.surgical_kits ENABLE ROW LEVEL SECURITY;

--
-- Name: malcon_tms_activity tms_activity_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_activity_insert" ON public.malcon_tms_activity;
CREATE POLICY tms_activity_insert ON public.malcon_tms_activity FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: malcon_tms_activity tms_activity_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_activity_select" ON public.malcon_tms_activity;
CREATE POLICY tms_activity_select ON public.malcon_tms_activity FOR SELECT TO authenticated USING (true);


--
-- Name: malcon_tms_profiles tms_profiles_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_profiles_select" ON public.malcon_tms_profiles;
CREATE POLICY tms_profiles_select ON public.malcon_tms_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: malcon_tms_tasks tms_tasks_delete; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_tasks_delete" ON public.malcon_tms_tasks;
CREATE POLICY tms_tasks_delete ON public.malcon_tms_tasks FOR DELETE TO authenticated USING ((created_by = auth.uid()));


--
-- Name: malcon_tms_tasks tms_tasks_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_tasks_insert" ON public.malcon_tms_tasks;
CREATE POLICY tms_tasks_insert ON public.malcon_tms_tasks FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: malcon_tms_tasks tms_tasks_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_tasks_select" ON public.malcon_tms_tasks;
CREATE POLICY tms_tasks_select ON public.malcon_tms_tasks FOR SELECT TO authenticated USING (true);


--
-- Name: malcon_tms_tasks tms_tasks_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "tms_tasks_update" ON public.malcon_tms_tasks;
CREATE POLICY tms_tasks_update ON public.malcon_tms_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--




-- ---------------------------------------------------------------------------
-- 3. Seed workflow departments + default settings
-- ---------------------------------------------------------------------------
INSERT INTO public.departments (id, name, description, color) VALUES
  ('11111111-0001-0001-0001-000000000001', 'Stores', 'Implant kit storage, inventory and verification.', 'bg-violet-100 text-violet-800'),
  ('11111111-0001-0001-0001-000000000002', 'Scrub Person', 'Assisting surgeons during the implant operation.', 'bg-blue-100 text-blue-800'),
  ('11111111-0001-0001-0001-000000000003', 'Cleaning & Audit', 'Sterilization, cleaning, and audit of surgical kits.', 'bg-cyan-100 text-cyan-800'),
  ('11111111-0001-0001-0001-000000000005', 'Accounts', 'Billing and invoicing for surgical procedures.', 'bg-emerald-100 text-emerald-800'),
  ('11111111-0001-0001-0001-000000000006', 'Bill Submission', 'Bill submission to hospitals.', 'bg-orange-100 text-orange-800'),
  ('11111111-0001-0001-0001-000000000007', 'Delivery', 'Delivery of implant kits to hospitals.', 'bg-rose-100 text-rose-800'),
  ('11111111-0001-0001-0001-000000000008', 'Drivers', 'Vehicle drivers for case and kit transport.', 'bg-teal-100 text-teal-800'),
  ('11111111-0001-0001-0001-000000000009', 'Office Staff', 'Office and administrative support staff.', 'bg-slate-100 text-slate-800')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color;

INSERT INTO public.app_settings (key, value, updated_by)
VALUES ('incentive_rate_per_km', '3', 'migration')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Storage buckets + object policies (stage photos, selfies, receipts)
-- ---------------------------------------------------------------------------
-- Stage photo uploads for employee submissions
-- Run in Supabase SQL Editor if not applied via CLI

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stage-photos',
  'stage-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated users can upload stage photos
DROP POLICY IF EXISTS "stage_photos_insert" ON storage.objects;

DROP POLICY IF EXISTS "stage_photos_insert" ON storage.objects;

CREATE POLICY "stage_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stage-photos');

-- Anyone can view (public bucket — URLs used in admin approval UI)
DROP POLICY IF EXISTS "stage_photos_select" ON storage.objects;

DROP POLICY IF EXISTS "stage_photos_select" ON storage.objects;

CREATE POLICY "stage_photos_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'stage-photos');

-- Users can update/delete their own uploads (path prefix not enforced — keep simple)
DROP POLICY IF EXISTS "stage_photos_update" ON storage.objects;

DROP POLICY IF EXISTS "stage_photos_update" ON storage.objects;

CREATE POLICY "stage_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stage-photos');

DROP POLICY IF EXISTS "stage_photos_delete" ON storage.objects;

CREATE POLICY "stage_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stage-photos');

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attendance_selfies_insert" ON storage.objects;

CREATE POLICY "attendance_selfies_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-selfies');

DROP POLICY IF EXISTS "attendance_selfies_select" ON storage.objects;

CREATE POLICY "attendance_selfies_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-selfies');

DROP POLICY IF EXISTS "attendance_selfies_select_public" ON storage.objects;

CREATE POLICY "attendance_selfies_select_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'attendance-selfies');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'petrol-receipts',
  'petrol-receipts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "petrol_receipts_insert" ON storage.objects;

CREATE POLICY "petrol_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'petrol-receipts');

DROP POLICY IF EXISTS "petrol_receipts_select" ON storage.objects;

CREATE POLICY "petrol_receipts_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'petrol-receipts');

UPDATE storage.buckets SET public = false WHERE id = 'stage-photos';

DROP POLICY IF EXISTS "stage_photos_select" ON storage.objects;

CREATE POLICY "stage_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stage-photos' AND public.is_super_admin());

-- Upload on submit (any signed-in user with case access)
DROP POLICY IF EXISTS "stage_photos_insert" ON storage.objects;

DROP POLICY IF EXISTS "stage_photos_insert" ON storage.objects;

CREATE POLICY "stage_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stage-photos');

-- ---------------------------------------------------------------------------
-- 5. API grants (RLS policies still decide row access)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

COMMIT;
