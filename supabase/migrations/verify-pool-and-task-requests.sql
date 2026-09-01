-- Paste this in Supabase → SQL Editor → Run
-- Tells you which pool / task-request migrations are applied.

-- 1) Helper function (from add-fcfs-case-pool / fix-fcfs-rtd-drivers-pool)
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'employee_can_claim_fcfs_case'
  ) THEN 'YES' ELSE 'NO — run add-fcfs-case-pool.sql (or fix-fcfs-rtd-drivers-pool.sql)' END
  AS employee_can_claim_fcfs_case_function;

-- 2) Employees can SEE open pool cases
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_employee_fcfs_pool'
  ) THEN 'YES' ELSE 'NO — run add-fcfs-case-pool.sql' END
  AS cases_employee_fcfs_pool_policy;

-- 3) Old instant-claim policy (should be GONE after add-case-task-requests.sql)
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_employee_fcfs_claim'
  ) THEN 'STILL THERE — run add-case-task-requests.sql to remove (request flow needs this gone)'
  ELSE 'NO (good — request + admin assign mode)' END
  AS cases_employee_fcfs_claim_policy;

-- 4) Task request table (from add-case-task-requests.sql)
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'case_task_requests'
  ) THEN 'YES' ELSE 'NO — run add-case-task-requests.sql' END
  AS case_task_requests_table;

-- 5) Task request RLS policies
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'case_task_requests'
ORDER BY policyname;

-- 6) Open pool cases right now (sanity check)
SELECT case_number, current_stage, status, current_department, assigned_employee_id IS NULL AS unassigned
FROM cases
WHERE current_stage IN ('Pickup from Hospital', 'Billing', 'Bill Submission')
  AND status IN ('Active', 'Draft')
  AND assigned_employee_id IS NULL
ORDER BY updated_at DESC
LIMIT 10;
