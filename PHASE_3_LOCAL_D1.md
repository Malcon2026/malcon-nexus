# Phase 3 — Local Cloudflare D1 Implementation

**Status:** Complete (local only)  
**Date:** 2026-10-14  
**Production Supabase / Hostinger SPA:** unchanged

---

## 1. Dependencies installed

Installed in `worker/` from `worker/package.json`:

| Package | Role |
|---------|------|
| `wrangler` ^4.40 | Local Worker + local D1 |
| `drizzle-orm` ^0.44.5 | ORM (schema + future queries) |
| `drizzle-kit` ^0.31.4 | Migration generation |
| `@cloudflare/workers-types` ^5.20261006.1 | Worker/D1 types |
| `typescript` ^5.9.3 | Typecheck |
| `hono` ^4.9.6 | Future router (stub only) |

```bash
cd worker && npm install
```

---

## 2. Local D1 configuration

`worker/wrangler.toml`:

- **Binding:** `env.DB` → `malcon-nexus-dev`
- **Local dev:** `database_id = "local"` (no production D1 id required)
- **Migrations:** `migrations_dir = "drizzle/migrations"`
- **Staging/production:** still `REPLACE_WITH_*_D1_ID` (not used in Phase 3)

Local state path (gitignored): `worker/.wrangler/state/v3/d1/`

**No `--remote` was used** for any D1 operation in this phase.

---

## 3. Migration generated

- **Source:** `worker/src/db/schema.ts`
- **Command:** `npm run db:generate`
- **Output:** `worker/drizzle/migrations/0000_skinny_plazm.sql`
- **Meta:** `worker/drizzle/migrations/meta/0000_snapshot.json`, `_journal.json`
- **Statements:** 30 tables, 44 indexes, foreign keys per Phase 2 design

Pre-generation checks: Drizzle Kit validated SQLite types, FKs, indexes, and NOT NULL/default columns from schema.

---

## 4. Tables created (30)

Core (23): `employees`, `hospitals`, `doctors`, `departments`, `surgical_kits`, `cases`, `notifications`, `approvals`, `activity_log`, `attendance_records`, `attendance_approval_requests`, `field_team_attendance_approvals`, `leave_requests`, `employee_food_selections`, `employee_daily_expenses`, `petrol_requests`, `location_trips`, `case_task_requests`, `case_alert_escalations`, `app_settings`, `login_otps`, `push_subscriptions`, `hospital_trip_punches`.

HR/TMS placeholders (7): `hr_walk_in_applications`, `hr_kyc_intake`, `hr_onboarding_tracks`, `hr_job_postings`, `malcon_tms_profiles`, `malcon_tms_tasks`, `malcon_tms_activity` — minimal `id` + `payload` JSON text stubs until production DDL is exported.

---

## 5. Indexes created

Validation reports **44** non-system indexes (e.g. `idx_activity_log_created_at`, `idx_cases_status_updated`, `idx_attendance_employee_punched`, unique index on `employees.email`).

---

## 6. Foreign keys created (highlights)

| Child | Parent | On delete |
|-------|--------|-----------|
| `cases.hospital_id` | `hospitals.id` | RESTRICT |
| `cases.doctor_id` | `doctors.id` | SET NULL |
| `cases.assigned_employee_id` | `employees.id` | SET NULL |
| `notifications.case_id` | `cases.id` | CASCADE |
| `approvals.case_id` | `cases.id` | CASCADE |
| `attendance_records.employee_id` | `employees.id` | CASCADE |

Local tests enable `PRAGMA foreign_keys = ON` before FK assertions.

---

## 7. Seed data created

**Script:** `worker/scripts/seed-local.mjs`  
**Data:** Fictional only (`@example.invalid`, fake phones, no production copy)

| Entity | Count |
|--------|------:|
| employees | 5 |
| hospitals | 3 |
| doctors | 5 |
| departments | 3 |
| surgical_kits | 2 |
| cases | 10 |
| notifications | 20 |
| activity_log | 20 |
| attendance_records | 10 |
| approvals | 1 |
| leave_requests | 1 |
| petrol_requests | 1 |
| location_trips | 1 |
| employee_daily_expenses | 1 |
| app_settings | 1 |

Re-seed clears dependent rows then re-inserts (idempotent for dev).

---

## 8. JSON validation

Tested via `npm run db:test`:

- `cases.stages` — UPDATE, SELECT, `JSON.parse` round-trip
- `cases.hospital_snapshot`, `cases.doctor_snapshot`, `cases.post_surgery_duties`
- `employees.departments` — array JSON text

Stored as **TEXT** containing valid JSON (SQLite/D1 pattern).

---

## 9. Money validation

**Convention:** amounts in **integer minor units** (paise for INR).

| Display | `*_amount_minor` |
|---------|------------------|
| ₹1250.50 | `125050` |
| ₹500.00 | `50000` |
| ₹750.00 (petrol seed) | `75000` |
| ₹250.00 (expense seed) | `25000` |

Formula: `minor = Math.round(major * 100)` (document for API/UI later).

Seed case `IMP-DEV-001`: `invoice_amount_minor` and `collected_amount_minor` = `125050`.

---

## 10. CRUD validation

`test-local-d1.mjs` covers INSERT / UPDATE / DELETE on `employees` (temp row). Other entities validated via seed + selective UPDATE on `cases` / `employees`.

---

## 11. Pagination & filtering validation

Demonstrated with raw SQL (egress-safe patterns):

- **Cases LIST:** explicit column list (no `stages` blob)
- **Cases DETAIL:** `stages` only when needed
- **Notifications:** `ORDER BY created_at DESC, id DESC` + `LIMIT`
- **activity_log:** date lower bound + `LIMIT`
- **attendance:** `employee_id` + `punched_at` filter
- **TV/gallery style:** `updated_at > ?` + summary columns + `LIMIT 50`

---

## 12. Worker → D1 validation

- `GET /health` → `{"ok":true,"environment":"development","backend":"d1-worker-stub"}`
- `GET /health/db` (development only) → `{"ok":true,"employees":5}`

Local: `npm run dev` then `curl http://localhost:8787/health/db`

---

## 13. Test results

| Command | Result |
|---------|--------|
| `npm run db:migrate:local` | Pass |
| `npm run db:seed` | Pass |
| `npm run db:validate` | Pass (30 tables + 7 placeholders) |
| `npm run db:test` | Pass (all checks) |
| Worker `/health` + `/health/db` | Pass |

**Failed:** none (after seed/SQL helper fixes in Phase 3 completion).

---

## 14. Known limitations

- No full REST API; Worker returns **501** except `/health` and dev `/health/db`.
- No Drizzle repository layer in Worker yet — tests use SQL via Wrangler CLI.
- HR/TMS tables are **placeholders** only (`payload` JSON).
- No R2, auth bridge, or SPA feature flag.
- `db:studio` targets Drizzle Kit file config, not live local D1 file path (use `wrangler d1 execute` for inspection).
- Re-seed requires clearing `app_settings` or using `INSERT OR REPLACE` (handled in seed script).

---

## 15. HR/TMS placeholder status

Present in schema and migration; **not** populated with business columns. Awaiting production PostgreSQL DDL export from Supabase (tables exist in backup export script only, not in SPA `src/`).

---

## 16. Commands — reproduce local setup

From repository root:

```bash
cd worker
npm install

# Fresh local database (optional)
npm run db:reset:local
# OR first-time:
npm run db:migrate:local

# After schema changes:
npm run db:generate
npm run db:migrate:local

npm run db:seed
npm run db:validate
npm run db:test

npm run dev
curl -s http://localhost:8787/health
curl -s http://localhost:8787/health/db
```

**Inspect local D1 (examples):**

```bash
npx wrangler d1 execute malcon-nexus-dev --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
npx wrangler d1 execute malcon-nexus-dev --local --command "PRAGMA foreign_key_list(cases);"
npx wrangler d1 execute malcon-nexus-dev --local --command "SELECT case_number, invoice_amount_minor FROM cases LIMIT 5;"
```

**Do not run in Phase 3:**

- `wrangler d1 ... --remote`
- `npm run deploy:production` / `deploy:staging` as part of local D1 setup

---

## Production safety checklist

| Check | Status |
|-------|--------|
| Supabase files / migrations unchanged | YES |
| `src/` SPA unchanged | YES |
| Production Supabase accessed | NO |
| Remote D1 accessed | NO |
| Production data imported | NO |
| Authentication / Storage changed | NO |
