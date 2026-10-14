# Phase 4.5 — Blocker Resolution Report

**Date:** 2026-10-14  
**Scope:** Resolve Phase 4 migration blockers (local D1 + scripts only)  
**Not done:** Production export/import, SPA/Supabase changes, auth, storage, deploy  

---

## A. Resolved blockers

### 1. `employee_daily_expenses` schema mismatch — **RESOLVED**

**Decision:** **Option A — preserve PostgreSQL structure** (matches `supabase/migrations/add-daily-expenses.sql` and `src/lib/database/repositories/supabaseRepositories.ts`).

The prior D1 design (`category`, `description`, `amount_minor`) did not match production or the SPA upsert shape. Money for this table stays as **NUMERIC-equivalent REAL columns**, not minor integers (unlike cases/petrol).

| PostgreSQL column | Type (PG) | D1 column | Type (D1) | Import notes |
|-------------------|-----------|-----------|-----------|--------------|
| `id` | UUID PK | `id` | TEXT PK | UUID string |
| `employee_id` | UUID NOT NULL FK → employees CASCADE | `employee_id` | TEXT NOT NULL FK | |
| `employee_name` | TEXT DEFAULT '' | `employee_name` | TEXT DEFAULT '' | |
| `expense_date` | DATE NOT NULL | `expense_date` | TEXT NOT NULL | `YYYY-MM-DD` |
| `kms_driven` | NUMERIC DEFAULT 0 | `kms_driven` | REAL DEFAULT 0 | |
| `petrol_amount` | NUMERIC DEFAULT 0 | `petrol_amount` | REAL DEFAULT 0 | |
| `food_amount` | NUMERIC DEFAULT 0 | `food_amount` | REAL DEFAULT 0 | |
| `other_amount` | NUMERIC DEFAULT 0 | `other_amount` | REAL DEFAULT 0 | |
| `other_description` | TEXT DEFAULT '' | `other_description` | TEXT DEFAULT '' | |
| `notes` | TEXT DEFAULT '' | `notes` | TEXT DEFAULT '' | |
| `entered_by` | TEXT DEFAULT '' | `entered_by` | TEXT DEFAULT '' | |
| `entered_by_id` | UUID FK SET NULL | `entered_by_id` | TEXT FK SET NULL | |
| `created_at` | TIMESTAMPTZ | `created_at` | TEXT ISO UTC | |
| `updated_at` | TIMESTAMPTZ | `updated_at` | TEXT ISO UTC | |

**Removed from D1 (never in PG):** `category`, `description`, `amount_minor`.

**Constraints / indexes (aligned):**

- UNIQUE (`employee_id`, `expense_date`) → `employee_daily_expenses_one_per_day`
- `idx_expenses_employee_id`, `idx_expenses_expense_date`

**Migration:** Regenerated `worker/drizzle/migrations/0000_famous_daimon_hellstrom.sql` (replaces `0000_skinny_plazm.sql`).

---

### 2. `app_settings.updated_by` — **RESOLVED**

| PostgreSQL | D1 |
|------------|-----|
| `key` TEXT PK | `key` TEXT PK |
| `value` TEXT NOT NULL | `value` TEXT NOT NULL |
| `updated_by` TEXT NOT NULL DEFAULT '' | `updated_by` TEXT NOT NULL DEFAULT '' |
| `updated_at` TIMESTAMPTZ NOT NULL | `updated_at` TEXT NOT NULL |

**FK:** None in PostgreSQL; D1 matches (plain TEXT).

**Application usage:** `sbSettingsRepo.set(key, value, updatedBy)` upserts `updated_by` + `updated_at` (`supabaseRepositories.ts`). Reads use `key, value` only.

---

### 3. HR/TMS tables — **NOT RESOLVED (blocked)**

See **§ B** below.

---

### 4. Production row counts — **RESOLVED (checklist only)**

Created read-only **`scripts/production-row-counts.sql`** for manual execution later. No production connection in Phase 4.5.

---

### 5. Export script table names — **RESOLVED**

**`scripts/export-supabase-backup.mjs`:**

| Before (wrong) | After |
|----------------|--------|
| `daily_expenses` | `employee_daily_expenses` |
| `employee_notice_board` | Removed (not a table; notice is `app_settings.key = 'employee_notice'`) |

Also added missing SPA-related tables: `case_alert_escalations`, `hospital_trip_punches`.

**`scripts/export-supabase-backup-sql.mjs`:** Uses `information_schema` dynamic discovery — no bogus table names; HR/TMS remain in optional skip list only.

---

## B. Remaining blockers

### HR/TMS — **BLOCKED — PRODUCTION DDL REQUIRED**

The seven tables are referenced in **`scripts/export-supabase-backup-sql.mjs`** (ESSENTIAL_SKIP list) but have **zero** definitions in:

- `supabase/schema.sql`
- All **73** files under `supabase/migrations/`
- `src/` (no queries)
- Supabase Edge Functions (no references)

| Table | Repo DDL | D1 today | Application usage |
|-------|----------|----------|-------------------|
| `hr_walk_in_applications` | **None** | Placeholder: `id`, `payload`, `created_at` | **Unknown** — not in SPA |
| `hr_kyc_intake` | **None** | Placeholder | **Unknown** |
| `hr_onboarding_tracks` | **None** | Placeholder | **Unknown** |
| `hr_job_postings` | **None** | Placeholder | **Unknown** |
| `malcon_tms_profiles` | **None** | Placeholder | **Unknown** |
| `malcon_tms_tasks` | **None** | Placeholder | **Unknown** |
| `malcon_tms_activity` | **None** | Placeholder | **Unknown** |

**Required from Supabase before Phase 5 HR/TMS import:**

1. Run section 6 in `scripts/production-row-counts.sql` (column inventory) for all seven tables.
2. Confirm tables exist in production (`information_schema.tables`).
3. Export `CREATE TABLE` equivalent (pg_dump `--schema-only` for those tables, or Dashboard DDL).
4. Document FKs, indexes, and whether any external app (outside this repo) writes to them.

**Do not invent columns.** Placeholder D1 tables remain until real DDL is available.

---

### Production row counts — **execution still required**

Checklist exists; **counts remain unknown** until someone runs `scripts/production-row-counts.sql` against linked Supabase (read-only).

---

## C. Files changed

| File | Change |
|------|--------|
| `worker/src/db/schema.ts` | PG-aligned `employee_daily_expenses`; `app_settings.updated_by` |
| `worker/drizzle/migrations/0000_famous_daimon_hellstrom.sql` | New full migration (replaces `0000_skinny_plazm.sql`) |
| `worker/drizzle/migrations/meta/*` | Regenerated journal + snapshot |
| `worker/scripts/seed-local.mjs` | Expense + app_settings seed columns |
| `worker/scripts/validate-local-d1.mjs` | Expense + `updated_by` checks; HR/TMS blocked notice |
| `scripts/export-supabase-backup.mjs` | Fixed table names |
| `scripts/production-row-counts.sql` | **Created** — read-only checklist |
| `worker/README.md` | Corrected daily expense money note |
| `PHASE_4_5_BLOCKER_RESOLUTION.md` | This report |

**Deleted:** `worker/drizzle/migrations/0000_skinny_plazm.sql` (superseded).

---

## D. Files intentionally untouched

- `src/` (Hostinger SPA)
- `supabase/` (73 migrations)
- Production Supabase / remote D1
- Authentication, Storage, Edge Functions
- `PHASE_4_SUPABASE_TO_D1_MIGRATION_PLAN.md` (historical Phase 4 snapshot)

---

## E. Local test results

| Command | Result |
|---------|--------|
| `npm run db:reset:local` | Pass |
| `npm run db:validate` | Pass (includes new expense + `updated_by` checks) |
| `npm run db:test` | Pass (JSON, money on cases, FK, CRUD, egress-safe SQL) |
| `GET /health` | Pass |
| `GET /health/db` | Pass (`employees: 5`) |

---

## F. Production actions still required (before Phase 5)

1. Run **`scripts/production-row-counts.sql`** via `npx supabase db query --linked -f scripts/production-row-counts.sql` (or Dashboard).
2. Export **HR/TMS DDL** from production (see § B).
3. Create **staging D1** and Worker API (Phase 5 scope).
4. Optional: run fixed **`export-supabase-backup.mjs`** when egress/API allows (not executed in 4.5).

---

## G. Information required before Phase 5

| Item | Status |
|------|--------|
| D1 `employee_daily_expenses` matches PG + SPA | **Ready** |
| D1 `app_settings.updated_by` | **Ready** |
| Per-table row counts + sizes | **Pending** — run `production-row-counts.sql` |
| HR/TMS full column definitions | **Pending** — production DDL |
| Staging D1 + import tooling | **Not started** (Phase 5) |
| Worker authorization + RPC ports | **Not started** (Phase 5+) |

---

PHASE 4.5 COMPLETE: YES

READY FOR PHASE 5: NO

*(Schema/export blockers addressed locally; HR/TMS DDL and production row-count execution remain mandatory before data migration.)*
