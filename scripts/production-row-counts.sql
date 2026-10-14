-- =============================================================================
-- Malcon Nexus — production row counts & size checklist (READ-ONLY)
-- =============================================================================
-- Purpose: Run manually against Supabase PostgreSQL before Phase 5 data migration.
-- Do NOT run from CI against production without explicit approval.
--
-- Recommended execution (linked CLI, read-only SELECT only):
--   npx supabase db query --linked -f scripts/production-row-counts.sql
--
-- Or paste sections into Supabase Dashboard → SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) All public base tables: approximate live rows (pg_stat; fast, may lag slightly)
-- -----------------------------------------------------------------------------
SELECT
  schemaname AS schema,
  relname AS table_name,
  n_live_tup AS approx_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, relname;

-- -----------------------------------------------------------------------------
-- 2) Authoritative COUNT(*) per table (slower; run in maintenance window if large)
--    Uncomment and run table-by-table if pg_stat is insufficient.
-- -----------------------------------------------------------------------------
/*
SELECT 'employees' AS table_name, COUNT(*) AS row_count FROM employees
UNION ALL SELECT 'hospitals', COUNT(*) FROM hospitals
UNION ALL SELECT 'doctors', COUNT(*) FROM doctors
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'surgical_kits', COUNT(*) FROM surgical_kits
UNION ALL SELECT 'cases', COUNT(*) FROM cases
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'approvals', COUNT(*) FROM approvals
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log
UNION ALL SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL SELECT 'attendance_approval_requests', COUNT(*) FROM attendance_approval_requests
UNION ALL SELECT 'field_team_attendance_approvals', COUNT(*) FROM field_team_attendance_approvals
UNION ALL SELECT 'leave_requests', COUNT(*) FROM leave_requests
UNION ALL SELECT 'petrol_requests', COUNT(*) FROM petrol_requests
UNION ALL SELECT 'location_trips', COUNT(*) FROM location_trips
UNION ALL SELECT 'employee_food_selections', COUNT(*) FROM employee_food_selections
UNION ALL SELECT 'employee_daily_expenses', COUNT(*) FROM employee_daily_expenses
UNION ALL SELECT 'case_task_requests', COUNT(*) FROM case_task_requests
UNION ALL SELECT 'case_alert_escalations', COUNT(*) FROM case_alert_escalations
UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings
UNION ALL SELECT 'login_otps', COUNT(*) FROM login_otps
UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM push_subscriptions
UNION ALL SELECT 'hospital_trip_punches', COUNT(*) FROM hospital_trip_punches
UNION ALL SELECT 'hr_walk_in_applications', COUNT(*) FROM hr_walk_in_applications
UNION ALL SELECT 'hr_kyc_intake', COUNT(*) FROM hr_kyc_intake
UNION ALL SELECT 'hr_onboarding_tracks', COUNT(*) FROM hr_onboarding_tracks
UNION ALL SELECT 'hr_job_postings', COUNT(*) FROM hr_job_postings
UNION ALL SELECT 'malcon_tms_profiles', COUNT(*) FROM malcon_tms_profiles
UNION ALL SELECT 'malcon_tms_tasks', COUNT(*) FROM malcon_tms_tasks
UNION ALL SELECT 'malcon_tms_activity', COUNT(*) FROM malcon_tms_activity
ORDER BY table_name;
*/

-- -----------------------------------------------------------------------------
-- 3) Table on-disk size (approximate total including indexes)
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- -----------------------------------------------------------------------------
-- 4) High-risk JSON payload sampling (cases)
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS case_count,
  pg_size_pretty(SUM(pg_column_size(stages))::bigint) AS stages_bytes_sum,
  pg_size_pretty(MAX(pg_column_size(stages))::bigint) AS max_stages_bytes,
  pg_size_pretty(AVG(pg_column_size(stages))::bigint) AS avg_stages_bytes
FROM cases;

-- -----------------------------------------------------------------------------
-- 5) Discover any public tables not listed above (run before Phase 5 import)
-- -----------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- 6) HR/TMS column inventory (when tables exist — paste results into Phase 5 docs)
-- -----------------------------------------------------------------------------
/*
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY table_name, ordinal_position;
*/

-- -----------------------------------------------------------------------------
-- 7) Storage object counts (metadata only; not file bytes)
-- -----------------------------------------------------------------------------
SELECT bucket_id, COUNT(*) AS object_count
FROM storage.objects
GROUP BY bucket_id
ORDER BY object_count DESC;
