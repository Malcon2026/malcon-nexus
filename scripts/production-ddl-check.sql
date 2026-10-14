-- =============================================================================
-- Malcon Nexus — HR/TMS production DDL discovery (READ-ONLY)
-- =============================================================================
-- Purpose: Collect column, constraint, and index metadata for the 7 HR/TMS
-- tables that exist in production but are NOT defined in this repo's migrations.
--
-- Tables (Phase 4 / 4.5):
--   hr_walk_in_applications
--   hr_kyc_intake
--   hr_onboarding_tracks
--   hr_job_postings
--   malcon_tms_profiles
--   malcon_tms_tasks
--   malcon_tms_activity
--
-- Safe to run: SELECT-only catalog queries. No DDL/DML on your data.
--
-- Recommended execution:
--   npx supabase link --project-ref <your-ref>   # once, if not linked
--   npx supabase db query --linked -f scripts/production-ddl-check.sql
--
-- Or: Supabase Dashboard → SQL Editor → paste and Run (read-only results).
--
-- Save the full CLI or Dashboard output for Phase 5 schema design.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Confirm which HR/TMS tables exist in public schema
-- -----------------------------------------------------------------------------
WITH expected(table_name) AS (
  VALUES
    ('hr_walk_in_applications'),
    ('hr_kyc_intake'),
    ('hr_onboarding_tracks'),
    ('hr_job_postings'),
    ('malcon_tms_profiles'),
    ('malcon_tms_tasks'),
    ('malcon_tms_activity')
)
SELECT
  e.table_name,
  CASE
    WHEN t.table_name IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END AS status
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = e.table_name
 AND t.table_type = 'BASE TABLE'
ORDER BY e.table_name;

-- -----------------------------------------------------------------------------
-- 1) Columns (name, type, nullability, default) — all 7 tables
-- -----------------------------------------------------------------------------
SELECT
  c.table_name,
  c.ordinal_position AS pos,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY c.table_name, c.ordinal_position;

-- -----------------------------------------------------------------------------
-- 2) Primary keys & UNIQUE constraints
-- -----------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  kcu.column_name,
  kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  AND tc.table_name IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- -----------------------------------------------------------------------------
-- 3) Foreign keys (parent → referenced table)
-- -----------------------------------------------------------------------------
SELECT
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  tc.constraint_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_schema = rc.constraint_schema
 AND tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_schema = ccu.constraint_schema
 AND rc.unique_constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- -----------------------------------------------------------------------------
-- 4) CHECK constraints (definition text)
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid, true) AS check_definition
FROM pg_constraint con
JOIN pg_class t ON t.oid = con.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND con.contype = 'c'
  AND t.relname IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY t.relname, con.conname;

-- -----------------------------------------------------------------------------
-- 5) Indexes (including non-constraint indexes)
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS index_definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY tablename, indexname;

-- -----------------------------------------------------------------------------
-- 6) Approximate row counts for HR/TMS (pg_stat — safe if a table is MISSING)
--     For exact COUNT(*), run per table that section 0 marked EXISTS, e.g.:
--     SELECT COUNT(*) FROM hr_walk_in_applications;
-- -----------------------------------------------------------------------------
WITH expected(table_name) AS (
  VALUES
    ('hr_walk_in_applications'),
    ('hr_kyc_intake'),
    ('hr_onboarding_tracks'),
    ('hr_job_postings'),
    ('malcon_tms_profiles'),
    ('malcon_tms_tasks'),
    ('malcon_tms_activity')
)
SELECT
  e.table_name,
  COALESCE(s.n_live_tup, 0) AS approx_row_count,
  CASE WHEN s.relname IS NULL THEN 'no stat (table missing or never analyzed)' ELSE 'ok' END AS stat_note
FROM expected e
LEFT JOIN pg_stat_user_tables s
  ON s.schemaname = 'public'
 AND s.relname = e.table_name
ORDER BY e.table_name;

-- -----------------------------------------------------------------------------
-- 7) Optional: RLS enabled? (metadata only)
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'hr_walk_in_applications',
    'hr_kyc_intake',
    'hr_onboarding_tracks',
    'hr_job_postings',
    'malcon_tms_profiles',
    'malcon_tms_tasks',
    'malcon_tms_activity'
  )
ORDER BY c.relname;
