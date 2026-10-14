# Phase 5 — Schema diff (Supabase production vs D1)

**Production reference:** `backups/production-checks-2026-10-14/`  
**D1 schema:** `worker/src/db/schema.ts` + migrations `0000`, `0001`

Legend: **RESOLVED** | **INTENTIONAL D1 DIFFERENCE** | **NOT APPLICABLE** | **BLOCKED**

---

## SPA core tables (23)

| Area | Production (PG) | D1 | Classification |
|------|-----------------|-----|----------------|
| UUID PKs/FKs | `uuid` | `TEXT` | **INTENTIONAL** — preserve string UUIDs |
| Timestamps | `timestamptz` | ISO `TEXT` | **INTENTIONAL** |
| Booleans | `boolean` | `INTEGER` 0/1 | **INTENTIONAL** |
| JSONB (`cases.*`, `employees.departments`) | `jsonb` | `TEXT` JSON | **INTENTIONAL** |
| `cases.invoice_amount` / `collected_amount` | `NUMERIC(12,2)` | `invoice_amount_minor` / `collected_amount_minor` `INTEGER` | **INTENTIONAL** — ×100 on import |
| `petrol_requests.amount` | `NUMERIC(10,2)` | `amount_minor` `INTEGER` | **INTENTIONAL** |
| `employee_daily_expenses` | multi-column NUMERIC | same column names, `REAL` | **RESOLVED** (Phase 4.5) |
| `app_settings.updated_by` | `TEXT NOT NULL` | present | **RESOLVED** (Phase 4.5) |
| PG `CHECK` enums (role, stage, status) | enforced in PG | `TEXT` without CHECK | **INTENTIONAL** — Worker validates on write |
| `update_updated_at()` trigger | PG trigger | app sets `updated_at` | **INTENTIONAL** |
| `auth.users` | Supabase Auth | not in D1 | **NOT APPLICABLE** — hybrid auth period |
| `idx_petrol_book_token` unique (book+token) | PG partial unique index | not in D1 schema | **BLOCKED** — add in Phase 6 if still required in prod |

No other unexplained column omissions for SPA tables used in `src/lib/database/repositories/supabaseRepositories.ts`.

---

## HR/TMS (7 tables)

| Table | Phase 4.7 D1 | Phase 5 D1 | Classification |
|-------|--------------|------------|----------------|
| All 7 | placeholder `payload` | full production columns (Phase 4.7 DDL) | **RESOLVED** via `0001_hr_tms_production_schema.sql` |

### Per-table notes

| Table | Translation notes |
|-------|-------------------|
| `hr_job_postings` | PG `id` is `text`; D1 `text` ✓. `data` jsonb → TEXT JSON. |
| `hr_walk_in_applications` | `form_data` jsonb → TEXT. |
| `hr_kyc_intake` | 37 columns; `form_data` jsonb → TEXT. PII columns plain TEXT. |
| `hr_onboarding_tracks` | `checkpoints` jsonb → TEXT; `esi_eligible` nullable boolean → integer nullable. |
| `malcon_tms_profiles` | PG CHECK `role = 'admin'` → **INTENTIONAL** omit SQLite CHECK; enforce in Worker. |
| `malcon_tms_tasks` | PG `tags text[]` → TEXT JSON array; status/priority CHECK → Worker. |
| `malcon_tms_activity` | FKs match production ON DELETE rules. |

### HR/TMS RLS (production)

Six of seven tables had RLS enabled in production (`hr_job_postings` did not). RLS is **NOT APPLICABLE** in D1; map to Worker authorization in a later API phase.

---

## Storage (not D1 tables)

| Item | Classification |
|------|----------------|
| `storage.objects` / buckets | **NOT APPLICABLE** to D1 schema |
| Extra bucket `hr-kyc-uploads` (3 objects) | Document for R2 phase; **NOT APPLICABLE** to relational import |

---

## Summary

| Status | Count |
|--------|-------|
| RESOLVED | HR/TMS placeholders, expenses, app_settings |
| INTENTIONAL | Types, money minor units, JSON text, no PG CHECK in SQLite |
| NOT APPLICABLE | auth.users, storage |
| BLOCKED | `idx_petrol_book_token` (optional follow-up) |

All tables planned for relational migration have a defined D1 column mapping.
