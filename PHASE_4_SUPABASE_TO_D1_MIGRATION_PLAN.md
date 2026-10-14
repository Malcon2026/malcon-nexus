# Phase 4 — Supabase → Cloudflare D1 Migration Plan

**Status:** Planning only (no migration executed)  
**Scope:** Analysis of `supabase/`, `src/`, `worker/`, and export scripts  
**Production:** Supabase SPA, migrations, and remote D1 unchanged  

---

## Executive summary

Malcon Nexus production data lives in **Supabase PostgreSQL** with **Row Level Security**, **Supabase Auth**, **Storage** (photos/receipts), and **22 Edge Functions**. The Hostinger SPA talks to PostgREST directly (`src/lib/database/repositories/supabaseRepositories.ts`).

Phase 3 created a **local D1** schema in `worker/src/db/schema.ts` with **30 public tables** (23 SPA-aligned + 7 HR/TMS placeholders). Before any production import, the D1 schema must be **reconciled with live PostgreSQL**—notably `employee_daily_expenses` and `app_settings.updated_by`. Authorization currently enforced in PostgreSQL must move to the **Worker** (Phase 2 design). Data volume must be measured on production with `COUNT(*)` (no committed manifest in this repo).

---

## 1. Production database inventory

### 1.1 Sources used

| Source | Purpose |
|--------|---------|
| `supabase/schema.sql` | Base tables, core RLS, helpers |
| `supabase/migrations/*.sql` (73 files) | Incremental DDL, RLS, RPCs, storage |
| `worker/src/db/schema.ts` | Target D1 mapping |
| `src/lib/database/repositories/supabaseRepositories.ts` | Tables the SPA actually queries |
| `scripts/export-supabase-backup.mjs` | REST export table list |
| `scripts/export-supabase-backup-sql.mjs` | `information_schema` full public table discovery |

**Not in repo:** live row counts (`backups/` is gitignored; no `manifest.json` committed).

### 1.2 Public application tables (PostgreSQL)

| # | Table | In D1 schema | SPA uses | Notes |
|---|--------|--------------|----------|-------|
| 1 | `employees` | Yes | Yes | `auth_user_id` → Supabase Auth |
| 2 | `hospitals` | Yes | Yes | |
| 3 | `doctors` | Yes | Yes | `doctor_code` (migration) |
| 4 | `departments` | Yes | Yes | PG `CHECK` on name enum |
| 5 | `surgical_kits` | Yes | Yes | Admin deferred bootstrap |
| 6 | `cases` | Yes | Yes | Large JSONB columns |
| 7 | `notifications` | Yes | Yes | |
| 8 | `approvals` | Yes | Yes | |
| 9 | `activity_log` | Yes | Yes | Admin deferred; limit 500 in repo |
| 10 | `attendance_records` | Yes | Yes | `selfie_url` |
| 11 | `attendance_approval_requests` | Yes | Yes | `selfie_url` |
| 12 | `field_team_attendance_approvals` | Yes | Yes | |
| 13 | `leave_requests` | Yes | Yes | RPC `submit_own_leave` |
| 14 | `petrol_requests` | Yes | Yes | `amount` NUMERIC; receipt URLs |
| 15 | `location_trips` | Yes | Yes | |
| 16 | `employee_food_selections` | Yes | Yes | RPC `submit_own_food_meals` |
| 17 | `employee_daily_expenses` | Yes (shape mismatch) | Yes | **See §1.4** |
| 18 | `case_task_requests` | Yes | Yes | FCFS task flow |
| 19 | `case_alert_escalations` | Yes | Edge Functions only | Not in `src/` grep |
| 20 | `app_settings` | Yes (column gap) | Yes | Keys: `tv_notice`, `employee_notice`, `doctor_master_list`, `incentive_rate_per_km`, etc. |
| 21 | `login_otps` | Yes | Edge Functions | Service role only in practice |
| 22 | `push_subscriptions` | Yes | Yes | Via `push-subscribe` EF |
| 23 | `hospital_trip_punches` | Yes | **No** `src/` references | Legacy / optional import |

### 1.3 Production-only tables (not in SPA; in SQL export script)

Discovered via `scripts/export-supabase-backup-sql.mjs` (not referenced in `src/`):

| Table | In D1 today | D1 representation |
|-------|-------------|-------------------|
| `hr_walk_in_applications` | Placeholder | `id`, `payload`, `created_at` only |
| `hr_kyc_intake` | Placeholder | same |
| `hr_onboarding_tracks` | Placeholder | same |
| `hr_job_postings` | Placeholder | same |
| `malcon_tms_profiles` | Placeholder | same |
| `malcon_tms_tasks` | Placeholder | same |
| `malcon_tms_activity` | Placeholder | same |

**Action before HR/TMS import:** Export `information_schema.columns` + sample rows from production; replace placeholders with real Drizzle columns (new migration), or store full row JSON in `payload` temporarily with a documented tradeoff.

### 1.4 Not a table (export script bug)

`scripts/export-supabase-backup.mjs` lists `employee_notice_board` and `daily_expenses` — **neither exists** as table names in migrations. Production uses:

- Notice board → `app_settings.key = 'employee_notice'` (`add-employee-notice-board.sql`)
- Expenses → `employee_daily_expenses`

Fix export scripts in Phase 5; do not create D1 tables for these names.

### 1.5 Supabase-managed (not D1 tables)

| Object | Migration approach |
|--------|-------------------|
| `auth.users` | Keep Supabase Auth through hybrid period; map `employees.auth_user_id` |
| `storage.buckets` / `storage.objects` | R2 + URL rewrite (Phase 8–10); not imported as SQL rows |
| Realtime | Not used (Phase 1 audit) |

### 1.6 Column / schema gaps (PostgreSQL vs D1)

| Area | PostgreSQL (authoritative) | D1 (`worker/src/db/schema.ts`) | Severity |
|------|---------------------------|----------------------------------|----------|
| **Daily expenses** | `kms_driven`, `petrol_amount`, `food_amount`, `other_amount`, `other_description`, `notes`, `entered_by`, `entered_by_id`; UNIQUE (`employee_id`, `expense_date`) | `category`, `description`, `amount_minor`, `entered_by_id` only | **Blocker** — SPA upserts PG shape (`supabaseRepositories.ts` ~1293) |
| **Case money** | `invoice_amount`, `collected_amount` NUMERIC(12,2) | `invoice_amount_minor`, `collected_amount_minor` INTEGER | Planned transform (×100) |
| **Petrol money** | `amount` NUMERIC(10,2) | `amount_minor` INTEGER | Planned transform |
| **app_settings** | `updated_by TEXT NOT NULL` | Missing `updated_by` | Medium — audit trail |
| **Petrol uniqueness** | `idx_petrol_book_token` on (`book_no`, `token_no`) | Not in D1 schema | Medium — integrity |
| **CHECK constraints** | Roles (`admin`, `employee`, `petrol`, `store_manager`), departments, case stages/status | TEXT without CHECK | Low — enforce in Worker |
| **PG enums / arrays** | `employees.departments` JSONB array | TEXT JSON | OK if valid JSON |
| **Timestamps** | `TIMESTAMPTZ` | ISO TEXT | OK — store UTC strings |
| **Booleans** | `BOOLEAN` | INTEGER 0/1 | OK — tested Phase 3 |

### 1.7 Type mismatches summary

See **§2** for mapping rules. Highest risk: **JSONB workflow payload** size on `cases`, **NUMERIC → minor integer** rounding, and **expense table shape**.

---

## 2. Data type mapping

| PostgreSQL | D1 / SQLite | Import rule |
|------------|-------------|-------------|
| `uuid` | `TEXT` | Copy string as-is |
| `text` / `varchar` | `TEXT` | Direct |
| `integer` / `int` | `INTEGER` | Direct |
| `bigint` | `INTEGER` | OK if values fit; verify `location_trips.trip_no` |
| `numeric(p,s)` money | `INTEGER` `*_minor` | `Math.round(parseFloat(x) * 100)`; document half-up |
| `numeric` non-money (kms) | `REAL` or `TEXT` | Expenses: keep as REAL columns after schema fix |
| `boolean` | `INTEGER` 0/1 | `value ? 1 : 0` |
| `date` | `TEXT` `YYYY-MM-DD` | From PG date |
| `timestamptz` | `TEXT` ISO-8601 UTC | `toISOString()` |
| `json` / `jsonb` | `TEXT` | `JSON.stringify`; validate parse on sample |
| PostgreSQL arrays | `TEXT` JSON array | e.g. `departments` |
| `ENUM` / `CHECK` | `TEXT` | Validate in Worker on write |
| FK `UUID` | `TEXT` + FK | Enable `PRAGMA foreign_keys=ON` on import batches |
| Nullable | Same | Preserve NULL |
| Defaults | App or INSERT default | PG `NOW()` → export literal or import-time UTC |

### 2.1 Critical JSON fields

| Column | Content | Import notes |
|--------|---------|--------------|
| `cases.stages` | `WorkflowStage[]` with nested employees, documents, URLs | Largest egress driver; preserve byte-for-byte JSON where possible |
| `cases.hospital_snapshot` / `doctor_snapshot` | Object snapshots | Required for UI when FK ids stale |
| `cases.post_surgery_duties` | Object | |
| `cases.activity_logs` | Legacy embedded array | Prefer `activity_log` table for new data; still migrate column |
| `cases.comments` | Thread JSON | |
| `cases.assigned_employee_snapshot` | Object or null | |
| `employees.departments` | string[] | Backfill rule in PG migration |

**Document URLs inside JSON:** Often Supabase Storage public/signed URLs → plan R2 rewrite pass (§8).

### 2.2 Money examples

| Display (INR) | PostgreSQL | D1 minor |
|---------------|------------|----------|
| ₹1250.50 | `1250.50` | `125050` |
| ₹500.00 | `500.00` | `50000` |

Petrol `amount`, case `invoice_amount` / `collected_amount` use this rule. **Daily expenses in PG are multi-column NUMERIC, not minor** — do not apply minor transform until schema aligned.

### 2.3 IDs and timestamps

- All primary keys remain **string UUIDs** (no new IDs on import).
- `created_at` / `updated_at`: preserve production values; Worker sets `updated_at` on UPDATE (replaces PG `update_updated_at()` trigger).

---

## 3. Foreign key / relationship map

### 3.1 Core graph (parent → child)

```text
hospitals ──RESTRICT──< cases
doctors ──SET NULL──< cases
employees ──SET NULL──< cases (assigned_employee_id)
employees ──CASCADE──< notifications (recipient)
cases ──CASCADE──< notifications
cases ──CASCADE──< approvals
cases ──CASCADE──< case_task_requests
cases ──CASCADE──< case_alert_escalations
employees ──CASCADE──< attendance_records
employees ──CASCADE──< leave_requests
employees ──CASCADE──< petrol_requests
employees ──CASCADE──< location_trips
employees ──CASCADE──< employee_food_selections
employees ──CASCADE──< employee_daily_expenses
employees ──CASCADE──< login_otps
employees ──CASCADE──< push_subscriptions
employees ──CASCADE──< hospital_trip_punches
hospitals ──SET NULL──< hospital_trip_punches
attendance_records ──SET NULL──< attendance_approval_requests (attendance_record_id)
employees ──CASCADE──< attendance_approval_requests
employees ──CASCADE──< field_team_attendance_approvals
doctors ──SET NULL──< hospitals (hospital_id)
```

### 3.2 ON DELETE behaviors to preserve

| Behavior | Example | Import test |
|----------|---------|-------------|
| RESTRICT | Delete hospital with cases | Must fail |
| CASCADE | Delete case → notifications | Orphan check after import |
| SET NULL | Delete doctor → `cases.doctor_id` | Sample row test |

### 3.3 Circular / soft dependencies

- **No hard FK cycles** in public schema.
- **Logical cycles:** `cases.stages` embeds employee IDs; `employees` does not FK to cases. Import **employees before cases**.
- **`auth.users` ↔ `employees.auth_user_id`:** Auth users imported/mapped separately; nullable OK.

### 3.4 Migration ordering constraints

1. `departments`, `hospitals` — no FK deps  
2. `employees` — references auth externally only  
3. `doctors` — needs hospitals  
4. `surgical_kits` — standalone  
5. `cases` — needs hospitals, doctors, employees  
6. All case-child tables — need cases  
7. Employee-child tables — need employees  
8. `app_settings`, `login_otps` — independent / employees  

HR/TMS: order TBD after DDL known (likely standalone or employee-linked).

---

## 4. Production data volume

**Rule:** Do not import or guess counts in Phase 4. Run before Phase 5 data work:

```sql
-- Via: npx supabase db query --linked
SELECT relname AS table, n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

Or per-table `SELECT COUNT(*) FROM ...` for authoritative counts.

| Table / group | Volume status | Notes |
|---------------|---------------|-------|
| `employees` | **Unknown** | Measure on production |
| `hospitals` | **Unknown** | |
| `doctors` | **Unknown** | |
| `cases` | **Unknown** | Export script uses small page size (12) due to JSON size — implies large payloads |
| `notifications` | **Unknown** | Phase 2 doc cites risk of very large inbox history; admin bootstrap can load **unbounded** rows (no limit when no `recipientId`) |
| `activity_log` | **Unknown** | SPA loads **500** max; full table may be huge — emergency export can skip (`BACKUP_ESSENTIAL=1`) |
| `attendance_records` | **Unknown** | Bootstrap loads 150-day window for admin |
| `approvals` | **Unknown** | |
| `leave_requests` | **Unknown** | |
| `employee_daily_expenses` | **Unknown** | |
| `petrol_requests` / `location_trips` | **Unknown** | |
| Case-related (`case_task_requests`, `case_alert_escalations`) | **Unknown** | |
| HR / TMS (7 tables) | **Unknown** | Not in SPA |
| Storage objects (`stage-photos`, `attendance-selfies`, `petrol-receipts`) | **Unknown** | `export-supabase-backup.mjs` inventories buckets when run |

**Confirmed from code (not row counts):**

- DB size was small vs egress in Phase 1 audit (~0.09 GB DB vs ~13 GB egress) — **egress is not proportional to stored rows alone**.
- `scripts/export-supabase-backup-sql.mjs` treats `activity_log`, `notifications`, HR/TMS as optional skips for emergency export.

---

## 5. RLS / security analysis

**Principle:** D1 has **no RLS**. Every rule below becomes **Worker middleware + route-level authorization** (`worker/src/middleware/authorization.ts`), using JWT identity → `employees.id` + `role` + department tags.

### 5.1 Identity helpers (PostgreSQL today)

| Function | Worker equivalent |
|----------|-------------------|
| `current_user_role()` | Load employee by JWT `sub` / email; read `role` |
| `current_employee_id()` | Map `auth_user_id` → `employees.id` |
| `employee_has_department_tag()` | Parse `departments` JSON + `department` |
| `employee_can_claim_fcfs_case()` | Service method for FCFS pool |
| `employee_is_assignee_on_open_stage()` | Parse `cases.stages` JSON |
| `is_super_admin()` | Config allowlist (emails) — **not** in D1 |

### 5.2 Table-by-table authorization (future Worker)

| Table | Read | Insert | Update | Delete | Notes |
|-------|------|--------|--------|--------|-------|
| **employees** | Admin all; self by auth | Self insert on signup flow | Admin all; self limited; store_manager select/update team | Admin | Petrol role can select/insert employees (desk) |
| **hospitals** | Authenticated | Admin | Admin | Admin | |
| **doctors** | Authenticated | Admin; store_manager insert | Admin | Admin | Master list also in `app_settings` |
| **departments** | Authenticated | — | — | — | Read-only in PG |
| **surgical_kits** | Authenticated | Admin | Admin | Admin | |
| **cases** | Admin + store_manager all; employee assigned / open stage / assistant on current stage; FCFS pool SELECT/claim UPDATE | Admin / store_manager | Admin / store_manager; employee via `save_case_for_session` rules | Admin / store_manager | Most complex policy set |
| **notifications** | Own recipient; admin all | System / admin | Own mark read | Own / admin | |
| **approvals** | Admin; store_manager all; employee read/insert if assigned on case | Employee submit | Admin / store_manager | Admin / store_manager | |
| **activity_log** | Admin; store_manager all; employee read (broad) | Authenticated insert | Admin | Admin | Prefer paginated API |
| **attendance_records** | Admin; store_manager all; employee own | Employee own | Employee own | Admin / store_manager | |
| **attendance_approval_requests** | Admin; store_manager select; employee own | Employee insert | Admin review | Admin | |
| **field_team_attendance_approvals** | Admin all; employee read own | Admin upsert | Admin | Admin | |
| **leave_requests** | Admin; store_manager; employee own | Employee via RPC / insert | Admin; employee cancel pending | Admin | |
| **petrol_requests** | Admin + petrol all; employee own | Employee pending | Employee cancel/receipt rules; admin/petrol issue | Admin | |
| **location_trips** | Admin; employee own | Employee start | Employee complete | Admin | One open trip partial unique index |
| **employee_food_selections** | Admin; employee own | Employee once | Employee once | Admin | RPC validation |
| **employee_daily_expenses** | **Admin only** | Admin | Admin | Admin | |
| **case_task_requests** | Admin; employee own | Employee | Admin review | Admin | |
| **case_alert_escalations** | Admin; employee read own | Service (EF) | Service | Admin | |
| **app_settings** | Admin all; authenticated read keys (notice) | Admin | Admin | Admin | |
| **login_otps** | **Deny** client | Service only | Service | Service | |
| **push_subscriptions** | Own | Own upsert | Own | Own | |
| **hospital_trip_punches** | Admin; employee select/insert | Employee | — | Admin | |
| **Storage** | Super-admin read stage photos; authenticated insert; attendance/petrol policies | Edge upload functions | — | — | Maps to R2 presign + Worker |

### 5.3 Special rules

- **FCFS pool** (`add-fcfs-case-pool.sql`, `fix-fcfs-rtd-drivers-pool.sql`): Unassigned cases in RTD/Billing/Bill Submission — department-aware claim.
- **Parallel workflow** (`fix-cases-parallel-workflow-rls.sql`): Assignees on non-header stages may UPDATE case JSON.
- **Stage photos**: View restricted to super-admin emails in PG; upload any authenticated user with case access.

---

## 6. Supabase functions / RPC / triggers

### 6.1 Triggers

| Trigger | Action | Classification |
|---------|--------|----------------|
| `update_updated_at()` on employees, hospitals, cases, surgical_kits, petrol_requests, location_trips | Set `updated_at = NOW()` | **A** — Worker service sets timestamp on PATCH |

### 6.2 SQL functions (RPC)

| Function | Purpose | Class |
|----------|---------|-------|
| `current_user_role()` | RLS helper | **A** — Worker auth context |
| `current_employee_id()` | RLS helper | **A** |
| `update_updated_at()` | Trigger | **A** |
| `employee_has_department_tag(employees, text)` | FCFS / departments | **A** |
| `employee_can_claim_fcfs_case(stage, dept)` | FCFS pool | **A** |
| `employee_is_assignee_on_open_stage(jsonb, uuid)` | Case SELECT/UPDATE | **A** |
| `employee_is_assignee_on_stages(jsonb, uuid)` | Header sync | **A** |
| `sync_case_header_from_stages(uuid)` | Heal header from stages | **B** — Worker transaction + JSON logic |
| `save_case_for_session(jsonb)` | Employee/store_manager case save with auth + merge | **B** — Critical; port to Worker case service |
| `submit_own_leave(...)` | Leave insert as self | **B** |
| `submit_own_food_meals(...)` | Food upsert with validation | **B** |
| `is_super_admin()` | Storage photo view | **A** — config allowlist |

**SPA RPC usage (`supabaseRepositories.ts`):**

- `save_case_for_session`
- `sync_case_header_from_stages`
- `submit_own_leave`
- `submit_own_food_meals`

**D — Can be removed:** None without product sign-off (all have active callers or RLS deps).

**E — Investigate:** Whether `sync_case_header_from_stages` remains needed if Worker always computes header server-side on save.

---

## 7. Edge Functions (22)

| # | Function | Purpose | Auth | Tables / storage | Worker route? |
|---|----------|---------|------|------------------|---------------|
| 1 | `request-login-otp` | Issue Telegram OTP; insert `login_otps` | Public + employee code | `employees`, `login_otps` | **Yes** — `/auth/otp/request` |
| 2 | `verify-login-otp` | Verify hash; Supabase magic link / session | Public | `employees`, `login_otps` | **Yes** — `/auth/otp/verify` (hybrid Auth) |
| 3 | `create-employee-login` | Create Auth user + link employee | Admin JWT | `employees`, Auth Admin API | **Yes** — admin HR route |
| 4 | `update-employee-login-email` | Sync Auth email | Admin JWT | `employees`, Auth | **Yes** |
| 5 | `upload-stage-photo` | Upload case stage image | JWT | `cases`, `employees`, `stage-photos` | **Yes** + R2 presign |
| 6 | `upload-attendance-selfie` | Selfie on punch/approval | JWT | `attendance_*`, `attendance-selfies` | **Yes** + R2 |
| 7 | `push-subscribe` | Save web push keys | JWT | `employees`, `push_subscriptions` | **Yes** |
| 8 | `send-push` | Web push for assignment | Service / internal | `cases`, `push_subscriptions` | **Yes** — internal service |
| 9 | `send-telegram` | Telegram notify assignee | Internal | `cases`, `employees` | **Yes** |
| 10 | `telegram-webhook` | Bot commands / link chat id | Telegram secret | `employees` | **Yes** |
| 11 | `telegram-broadcast` | Admin broadcast | Admin | `employees` | **Yes** |
| 12 | `send-assignment-email` | Email on assign | Internal | `cases`, `employees` | **Yes** (Resend) |
| 13 | `start-case-alerts` | Create escalation row | JWT | `case_alert_escalations` | **Yes** |
| 14 | `acknowledge-case-alerts` | Ack alert | JWT | `case_alert_escalations` | **Yes** |
| 15 | `process-alert-escalations` | Cron escalations | Service | `case_alert_escalations`, delivery | **Yes** — Cron Trigger |
| 16 | `test-case-alerts` | Dev test | Restricted | alerts | **E** — dev only |
| 17 | `tv-board-feed` | Kiosk JSON: **cases\*, employees\*, settings** | `TV_BOARD_TOKEN` query | Full table scans | **Yes** — summary + `updatedSince` |
| 18 | `gallery-feed` | Gallery/TV aggregate feed | Token | cases, employees, attendance, settings | **Yes** — egress-safe design |
| 19 | `gallery` | HTTP redirect to GitHub Pages gallery | Token | None | **C** — keep redirect or static |
| 20 | `dashboard-insights` | Aggregated metrics for dashboards | JWT | cases, employees, settings | **Yes** — SQL aggregates in Worker |
| 21 | `location-bike-route` | Google/Mappls bike route | JWT | None (external APIs) | **Yes** — proxy route |
| 22 | `location-hospital-search` | Hospital geosearch | JWT | External Mappls | **Yes** — proxy route |

External APIs: Telegram Bot API, Google Routes, Mappls, Resend (email), Web Push (VAPID).

---

## 8. Storage migration plan (design only)

### 8.1 Buckets (Supabase today)

| Bucket | Visibility (current) | DB references |
|--------|----------------------|---------------|
| `stage-photos` | Private; super-admin SELECT (RLS) | `cases.stages[].documents[].url`, thumbs |
| `attendance-selfies` | Public read policies exist | `attendance_records.selfie_url`, `attendance_approval_requests.selfie_url` |
| `petrol-receipts` | Authenticated read/write | `petrol_requests.receipt_url`, `kms_photo_url` |

### 8.2 Target (Cloudflare R2)

| Supabase bucket | R2 bucket (proposed) | Access |
|-----------------|----------------------|--------|
| `stage-photos` | `malcon-nexus-stage-photos-{env}` | Private; signed GET for super-admin; presigned PUT on upload |
| `attendance-selfies` | `malcon-nexus-attendance-selfies-{env}` | Private; signed GET for admin/self |
| `petrol-receipts` | `malcon-nexus-petrol-receipts-{env}` | Private; admin/petrol + owning employee |

### 8.3 Object naming

Preserve path structure where possible: `{caseId}/{stage}/{uuid}-full.jpg` (match existing upload paths in `upload-stage-photo` / `stagePhotos.ts`) to simplify rewrite.

### 8.4 URL / reference migration (phased)

1. **Inventory** — list all objects + DB URL references (export script pattern).  
2. **Copy** — `rclone` or Worker batch copy Supabase → R2 (Phase 10).  
3. **Rewrite** — Update JSON text fields and URL columns to CDN/signed URL pattern or stable `r2Key` + Worker resolver.  
4. **Dual-read** — Worker accepts old Supabase URLs during transition (optional).  

### 8.5 Authorization

- Upload: JWT + case/attendance authorization (same rules as EF).  
- Download: super-admin for stage photos; role-scoped for selfies/receipts.  
- **Do not** make R2 buckets public by default (Phase 2).

---

## 9. Authentication plan (no migration in Phase 4)

### 9.1 Current flows (`src/lib/auth.ts`, `Login.tsx`)

| Flow | Mechanism |
|------|-----------|
| **Admin** | Email + password → `supabase.auth.signInWithPassword` → employee row by email; reject non-admin roles |
| **Employee** | Employee code → `request-login-otp` EF → Telegram → `verify-login-otp` → `supabase.auth.verifyOtp` → session |
| **Store manager / petrol** | Same OTP or password rules per `roles.ts` |
| **Session** | Supabase JWT in client; `auth_user_id` on `employees` |
| **Link** | `create-employee-login` / `update-employee-login-email` EFs |

### 9.2 Hybrid period (recommended)

1. **Keep Supabase Auth** for login; Worker validates Supabase JWT (JWKS) until custom auth is ready.  
2. Map `auth.uid()` → `employees.auth_user_id` on every Worker request.  
3. OTP tables (`login_otps`) move to D1; pepper `LOGIN_OTP_SECRET` on Worker.  
4. Long term: optional dedicated JWT issuer on Worker (Phase 2 `JWT_SECRET`) — **not required for first D1 cutover**.

### 9.3 What does not move in first data migration

- `auth.users` passwords/hashes stay in Supabase Auth until explicit auth migration phase.  
- SPA continues Supabase client for Auth even when API reads D1 (feature flag).

---

## 10. Data migration order (executable sequence)

| Phase | Tables / data | Why safe |
|-------|---------------|----------|
| **A0** | Schema alignment migration on D1 (fix expenses, `app_settings.updated_by`, petrol unique index) | Import must match PG |
| **A** | `departments`, `app_settings` (keys only) | No FK dependencies |
| **B** | `hospitals`, `surgical_kits` | Referenced by cases/doctors |
| **C** | `employees` | Parent for most tables; map `auth_user_id` |
| **D** | `doctors` | FK → hospitals |
| **E** | `cases` | Largest JSON; FK → hospitals, doctors, employees |
| **F** | `approvals`, `case_task_requests`, `case_alert_escalations`, `notifications` | FK → cases, employees |
| **G** | `attendance_records`, `attendance_approval_requests`, `field_team_attendance_approvals` | FK → employees |
| **H** | `leave_requests`, `employee_food_selections`, `petrol_requests`, `location_trips`, `employee_daily_expenses`, `hospital_trip_punches` | Employee-centric |
| **I** | `activity_log`, `login_otps`, `push_subscriptions` | High volume / sensitive; optional batched |
| **J** | HR/TMS tables | After real DDL; may use JSON `payload` interim |
| **K** | Storage object copy + URL rewrite | After DB IDs stable |

**Within each phase:** disable FK checks only if absolutely necessary (prefer ordered inserts); run `PRAGMA foreign_key_check` after each phase on staging D1.

---

## 11. Large / high-risk tables and fields

| Risk | Mitigation |
|------|------------|
| **`cases` row size** | Batch export (page size 12 in SQL export script); stream import; never `SELECT *` on list endpoints after cutover |
| **`cases.stages` JSON** | Validate JSON parse post-import; sample deep compare with PG |
| **`notifications` volume** | Admin bootstrap currently unbounded — fix in Worker API before cutover; archive old rows policy |
| **`activity_log` volume** | Import all for parity OR cap + archive; SPA only needs paginated tail |
| **Photo URLs in JSON** | Second-pass rewrite after R2 copy; broken images until Phase 10 complete |
| **Money rounding** | Spot-check invoice/collected/petrol totals vs PG |
| **FCFS / parallel workflow** | Authorization regression tests on imported cases |
| **`login_otps`** | Short TTL; can skip historical rows |
| **HR/TMS unknown DDL** | Do not import until schema confirmed |

---

## 12. Cutover strategy

### 12.1 Principles

- **SPA stays on Supabase** until staging D1 + Worker API pass acceptance tests.  
- **No dual-write** initially — single writer (Supabase) until flag flip; then single writer (Worker → D1).  
- **Rollback:** DNS/feature flag back to Supabase PostgREST; D1 snapshot retained.

### 12.2 Steps

1. **Backup** — `export-supabase-backup-sql.mjs` full public schema + data; separate Auth export; storage inventory.  
2. **Staging D1** — Create remote **staging** D1 (not production id placeholders); apply Drizzle migrations after schema fix.  
3. **Import** — Run ordered import (§10) into staging D1 only.  
4. **Validation** — Row counts per table; FK check; JSON sample hashes; money spot checks; FK orphan queries.  
5. **Application testing** — Worker API against staging D1; SPA behind flag pointing to staging Worker (Phase 8).  
6. **Production import** — Repeat import to production D1 during maintenance window (read-only on Supabase).  
7. **Cutover** — Enable `VITE_MALCON_API_URL`; disable direct PostgREST for app routes.  
8. **Monitor** — Error rates, latency, TV/gallery feeds, OTP login, case save.  
9. **Rollback window** — Keep Supabase read-only + backup 7–14 days.

### 12.3 Comparison checks (automated script — Phase 5)

```text
For each table: COUNT(*) PG vs D1
Sample N rows: hash of canonical JSON for cases.id IN (...)
Sum(invoice_amount) vs sum(invoice_amount_minor)/100
notifications per recipient_id count
```

---

## 13. Egress reduction (Supabase today → Worker + D1)

| Pattern today | Where | Worker + D1 fix |
|---------------|-------|-----------------|
| `select('*')` on **cases** | `sbCaseRepo.getAll`, TV/gallery EFs | List projection; `updatedSince` summary endpoint |
| **Admin bootstrap** loads full cases, employees, notifications | `bootstrap.ts` | Role-scoped `/api/bootstrap/*` with limits |
| **Notifications** unbounded for admin | `sbNotificationRepo.getAll()` without recipient | Paginated cursor; max 50–200 |
| **Activity log** 500 cap but still `select('*')` | `sbActivityRepo` | Column projection + date filter + pagination |
| **TV 30s refresh** + full case fetch | `TvBoard.tsx`, `tv-board-feed` | Incremental summary + ETag; no full stages blob |
| **Gallery feed** full cases/employees | `gallery-feed/index.ts` | Same as TV |
| **Stage photo signed URLs** | Storage + JSON | R2 CDN/signed; metadata separate from case list |
| **Repeated bootstrap** | Session cache mitigates; still refetch | Server-driven minimal bundles |
| **PostgREST** per-row overhead | All repos | Single Worker hop; binary JSON; no RLS round trips |

Storage image delivery egress drops when served from R2/CDN with cache headers vs Supabase Storage API.

---

## 14. Phase 5 prerequisites

Complete **before** production data export/import:

- [ ] **Measure production row counts** and largest `cases` JSON payload size (`pg_column_size(stages)` sample).  
- [ ] **Fix D1 schema** to match PostgreSQL for `employee_daily_expenses` (and reconcile Phase 2 “minor” doc vs PG multi-column NUMERIC).  
- [ ] Add **`app_settings.updated_by`** (and any other missing PG columns).  
- [ ] Add **`idx_petrol_book_token`** equivalent on D1 if still enforced in production.  
- [ ] **Export HR/TMS DDL** from production (`information_schema`) and replace placeholder tables or document deferral.  
- [ ] Fix **`export-supabase-backup.mjs`** table list (`employee_daily_expenses`, remove bogus names).  
- [ ] Create **staging D1** in Cloudflare; set `REPLACE_WITH_STAGING_D1_ID` (not local).  
- [ ] Implement **minimal Worker API** on staging: health, auth bridge, case list/detail, case save port of `save_case_for_session`.  
- [ ] Port **authorization matrix** (§5) for cases, notifications, attendance at minimum.  
- [ ] Define **import tool** (Node script: PG JSON/CSV → D1 batch insert with transforms).  
- [ ] **Validation script** (counts, FK, JSON, money) checked into `worker/scripts/`.  
- [ ] **Rollback + maintenance window** plan approved.  
- [ ] **No Phase 5 work** until above signed off.

---

## Document control

| Item | Value |
|------|--------|
| Phase 4 deliverable | This file only |
| Code changes in Phase 4 | None |
| Production touched | No |

---

READY FOR PHASE 5: NO

*(Planning complete; execution blocked on schema reconciliation, production volume measurement, staging D1 + Worker API prerequisites, and HR/TMS DDL confirmation.)*
