# Phase 10 — Write audit (Supabase mutations inventory)

**Scope:** Every **write** path identified in this repo as of Phase 9.4 completion.  
**Not audited as D1 migrations:** Supabase Auth API calls, Storage blob uploads (separate track), Edge Functions that only send email/Telegram without DB (still listed if they mutate DB).

**Primary source file:** `src/lib/database/repositories/supabaseRepositories.ts`  
**Callers:** Mostly `src/store/useStore.ts`; wrappers in `src/lib/database/repositories/{tasks,employees,hospitals,doctors,approvals,notifications}.ts`; `src/lib/auth.ts` (`linkAuthUser`).

---

## Summary counts

| Category | Count |
|----------|------:|
| **SPA PostgREST write operations** (`sb*Repo` methods) | **47** |
| Edge Function DB mutations (parallel track) | 12 |
| Storage upload mutations | 2 (+ EF selfie) |
| Auth API / OTP (non-PostgREST) | 4+ |

---

## A. SPA repository write operations (47)

Legend — **Risk:** LOW / MEDIUM / HIGH  
**Parity:** needs live Supabase to verify behavior match  
**Txn:** transaction recommended  
**Idem:** idempotency concern  

### A.1 Employees — `sbEmployeeRepo` (4) — mostly **MEDIUM**; `linkAuthUser` **HIGH**

| # | Method | Table | Caller | Risk | Notes |
|---|--------|-------|--------|------|-------|
| 1 | `create` | `employees` | Admin UI / `useStore` | MEDIUM | Columns: profile, dept JSON, role, counts; FK none; RLS admin; trigger `updated_at` |
| 2 | `update` | `employees` | Admin, workflow (cases_active/completed) | MEDIUM | Partial patch; many call sites in `useStore` |
| 3 | `delete` | `employees` | Admin | MEDIUM | CASCADE to many tables in PG/D1 |
| 4 | `linkAuthUser` | `employees.auth_user_id` | `auth.ts` self-heal | **HIGH** | **Auth-dependent**; must stay aligned with Supabase Auth until Auth track |

### A.2 Hospitals — `sbHospitalRepo` (3) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 5 | `create` | `hospitals` | Admin hospitals |
| 6 | `update` | `hospitals` | Admin |
| 7 | `delete` | `hospitals` | Admin; RESTRICT if cases reference |

### A.3 Doctors — `sbDoctorRepo` (3) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 8 | `create` | `doctors` + **`app_settings` upsert** (master list) | Admin |
| 9 | `update` | `doctors` + optional master list | Admin |
| 10 | `delete` | `doctors` | Admin |

Side effect: doctor master list JSON in `app_settings` — **transaction** with doctor row.

### A.4 Cases — `sbCaseRepo` (5) — **HIGH**

| # | Method | Table / RPC | Caller |
|---|--------|-------------|--------|
| 11 | `create` | `cases` INSERT full row + JSON stages | Case create |
| 12 | `update` | **`save_case_for_session` RPC**; fallback `sync_case_header_from_stages` + direct UPDATE | **All workflow** in `useStore` (~40+ call sites) |
| 13 | `delete` | `cases` | Admin |
| 14 | `saveAll` | loops create/update | Legacy bulk |
| 15 | `claimCase` | conditional UPDATE + stages | FCFS pool; RLS `cases_employee_fcfs_claim` |

**RPC / RLS / JSON:** Port `save_case_for_session`, `sync_case_header_from_stages`, helper functions `employee_is_assignee_on_*`, `current_employee_id()`, `current_user_role()`.  
**Parity required:** assignee mismatch, stage handoff, parallel workflow, payment fields.  
**Txn:** single case row + stages JSON atomic.  
**Side effects:** activity log, notifications, emails, telegram, case alerts (SPA after write).

### A.5 Notifications — `sbNotificationRepo` (3) — **LOW**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 16 | `create` | `notifications` | `notificationRepository`, workflows |
| 17 | `markRead` | UPDATE `is_read` | UI |
| 18 | `markAllRead` | bulk UPDATE | UI |

### A.6 Approvals — `sbApprovalRepo` (1) — **LOW**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 19 | `upsert` | `approvals` | `approvalRepository`, stage submit |

RLS: admin/store_manager; employee insert policy for own submissions (`policies/approvals-employee-insert.sql`).

### A.7 Case task requests — `sbCaseTaskRequestRepo` (3) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 20 | `create` | `case_task_requests` | Employee pool request |
| 21 | `updateStatus` | UPDATE | Admin queue |
| 22 | `resolvePendingForCase` | multiple UPDATEs | Admin assign — **Txn** |

Partial unique: one pending per `(case_id, employee_id)`.

### A.8 Activity — `sbActivityRepo` (1) — **LOW**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 23 | `insert` | `activity_log` | `useStore` helper after actions |

### A.9 Attendance — `sbAttendanceRepo` (3) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 24 | `insert` | `attendance_records` | Punch in/out |
| 25 | `update` | `selfie_url` only | After EF upload |
| 26 | `deleteByIds` | admin register | Admin |

RLS: employee own vs admin/store_manager.

### A.10 Attendance approvals — `sbAttendanceApprovalRepo` (3) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 27 | `insert` | `attendance_approval_requests` | Offsite punch |
| 28 | `update` | status review | Admin |
| 29 | `deleteByIds` | admin | Admin |

### A.11 Field team — `sbFieldTeamAttendanceRepo` (2) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 30 | `upsert` | `field_team_attendance_approvals` | Admin bulk |
| 31 | `update` | review fields | Admin |

Unique `(employee_id, date_key)`.

### A.12 Leave — `sbLeaveRepo` (3) — **MEDIUM** (RPC path **HIGH** for employee)

| # | Method | Table / RPC | Caller |
|---|--------|-------------|--------|
| 32 | `insert` | **`submit_own_leave` RPC** or INSERT | Employee / admin |
| 33 | `update` | admin approve/reject | Admin |
| 34 | `deleteByIds` | admin | Admin |

RPC: validates auth.uid → employee, leave type enum, dates, reason length.

### A.13 Expenses — `sbExpenseRepo` (2) — **LOW**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 35 | `upsert` | `employee_daily_expenses` | Admin expenses UI |
| 36 | `delete` | same | Admin |

Unique `(employee_id, expense_date)`.

### A.14 Settings — `sbSettingsRepo` (1) — **LOW**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 37 | `set` | `app_settings` upsert | Admin notice/TV/incentive |

### A.15 Kits — `sbKitRepo` (1) — **LOW**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 38 | `update` | `surgical_kits` | Admin kit board |

### A.16 Petrol — `sbPetrolRepo` (4) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 39 | `insert` | `petrol_requests` | Employee / petrol desk |
| 40 | `update` | status, receipt fields | Admin / employee |
| 41 | `remove` | DELETE one | Admin |
| 42 | `removeAll` | DELETE all | Admin tool |

Partial unique: one open pending/issued per employee. Trigger `updated_at`.

### A.17 Location trips — `sbLocationTripRepo` (3) — **MEDIUM**

| # | Method | Table | Caller |
|---|--------|-------|--------|
| 43 | `insert` | `location_trips` | Kms / field app |
| 44 | `update` | end trip, bike fields | Employee |
| 45 | `remove` | DELETE | Admin |

Unique one `status=started` per employee. Column fallback retries in repo for legacy PG.

### A.18 Food — `sbFoodRepo` (3) — **MEDIUM** (employee RPC **HIGH**)

| # | Method | Table / RPC | Caller |
|---|--------|-------------|--------|
| 46 | `submitOwn` | **`submit_own_food_meals` RPC** | Employee |
| 47 | `upsert` / `adminSubmit` | `employee_food_selections` | Fallback / admin |

RPC: ownership, meal date, one-time update rules (`food_employee_update_once` policy).

---

## B. Non-repository SPA writes

| Location | Operation | Risk |
|----------|-----------|------|
| `src/lib/database/storage.ts` `_persist` | Generic `upsert` for non-repo collections | LOW (legacy); bypassed for most entities |
| `src/lib/stagePhotos.ts` | **Storage** upload to `stage-photos` | Deferred (Storage track) |
| `src/lib/attendanceSelfie.ts` | EF `upload-attendance-selfie` → Storage + DB URL | Deferred |

---

## C. Edge Function DB mutations (12)

| Function | Tables | Auth | Risk |
|----------|--------|------|------|
| `request-login-otp` | `login_otps` INSERT | service | **HIGH** — Auth track |
| `verify-login-otp` | `login_otps` UPDATE | service | **HIGH** |
| `create-employee-login` | Auth user + `employees` UPDATE | admin | **HIGH** |
| `update-employee-login-email` | Auth + `employees` | admin | **HIGH** |
| `push-subscribe` | `push_subscriptions` UPSERT | user JWT | MEDIUM |
| `send-push` | `push_subscriptions` DELETE stale | service | LOW |
| `upload-attendance-selfie` | `attendance_records` UPDATE + Storage | user | MEDIUM + Storage |
| `start-case-alerts` | `case_alert_escalations` UPSERT | JWT | MEDIUM |
| `acknowledge-case-alerts` | UPDATE | JWT | MEDIUM |
| `process-alert-escalations` | UPDATE timestamps | cron | MEDIUM |
| `dashboard-insights` | `app_settings` UPSERT cache | admin | LOW |
| `telegram-webhook` | `employees.telegram_chat_id` UPDATE | webhook | MEDIUM |

**Not Phase 10:** replace messaging/alert EFs only when secrets + scheduling exist on Worker.

---

## D. RPC / Postgres function dependencies

| Function | Used by | Reproduce in Worker? |
|----------|---------|----------------------|
| `save_case_for_session(jsonb)` | `sbCaseRepo.update` | **Yes — HIGH effort** |
| `sync_case_header_from_stages(uuid)` | case update retry | **Yes** |
| `submit_own_leave(...)` | `sbLeaveRepo.insert` | **Yes** |
| `submit_own_food_meals(...)` | `sbFoodRepo.submitOwn` | **Yes** |
| `current_employee_id()` / `current_user_role()` | inside RPCs/RLS | Map from JWT |
| `employee_is_assignee_on_open_stage` / `_stages` | RPC + RLS | Port to TS |
| `employee_can_claim_fcfs_case` | RLS FCFS | Port to TS |
| `is_super_admin()` | Storage RLS | Port for future R2 |

---

## E. Trigger dependencies

| Trigger | Table | D1 note |
|---------|-------|---------|
| `set_updated_at_employees` | employees | Set in service |
| `set_updated_at_hospitals` | hospitals | Set in service |
| `set_updated_at_cases` | cases | Set in service |
| `set_updated_at_kits` | surgical_kits | Set in service |
| `set_updated_at_petrol` | petrol_requests | Set in service |

No automatic PG triggers on leave/food; `updated_at` often set in app.

---

## F. Risk rollup (47 SPA write operations)

### LOW (9)

`activity.insert`; `notifications` create/markRead/markAllRead; `settings.set`; `kit.update`; `expense` upsert/delete; `approval.upsert`.

### MEDIUM (30)

Employees create/update/delete; hospitals/doctors CRUD; attendance + approval + field team; leave update/delete; food admin/upsert; petrol CRUD; location trips; case task create/update/resolve; attendance punch/update/delete (non-RPC).

### HIGH (8)

`case` create/update/delete/saveAll; `claimCase`; `leave.insert` (RPC path); `food.submitOwn` (RPC path); `linkAuthUser`.

---

## G. Auth-dependent writes

- `submit_own_leave`, `submit_own_food_meals`, `save_case_for_session` (session employee id).  
- `linkAuthUser` + `create-employee-login` / `update-employee-login-email`.  
- OTP insert/consume (`login_otps`).  
- RLS-protected employee inserts (attendance, leave, food, petrol, case task, approvals).

Worker must validate JWT → employee row **before** any self-service write.

---

## H. Requires Supabase restoration (parity testing)

Until egress 402 is cleared or staging PG is available:

| Operation | Why |
|-----------|-----|
| Case `update` / `claimCase` | RPC + RLS + JSON drift |
| Employee stage submit / handoff | Documented production edge cases |
| `submit_own_leave` / `submit_own_food_meals` | SECURITY DEFINER semantics |
| FCFS claim race | Conditional UPDATE behavior |
| Notification + activity side effects after case write | End-to-end UX |

Mark parity tests **NOT VERIFIED** while 402 blocks Supabase.

---

## I. PostgreSQL vs D1 gaps (all writes)

| PG feature | Impact |
|------------|--------|
| RLS | Must be Worker authorization |
| SECURITY DEFINER RPC | Port logic explicitly |
| `jsonb` operators in RPC | SQLite JSON + app logic |
| Partial unique indexes | Enforce in service |
| FK ON DELETE rules | Drizzle schema already mirrors; test CASCADE |
| `NOW()` / timestamptz | ISO strings in D1; consistent UTC |
| `auth.uid()` | Supabase JWT only until Auth migrates |

---

## J. Side effects (not always in same transaction)

After successful PostgREST write, `useStore` often:

- Inserts **activity_log** (separate request).  
- Creates **notifications** (local + optional Supabase).  
- Invokes **send-telegram**, **send-assignment-email**, **send-push**, **caseAlerts** Edge Functions.

Write migration should preserve ordering or introduce Worker outbox later.

---

## Final report

**WRITE OPERATIONS FOUND:** 47 (SPA `sb*Repo` mutation methods)

**LOW RISK:** 9 — activity insert; notifications (3); settings set; kit update; expenses (2); approvals upsert  

**MEDIUM RISK:** 30 — employees (3); hospitals (3); doctors (3); attendance (3); attendance approvals (3); field team (2); leave update/delete (2); food upsert/admin (2); petrol (4); location (3); case tasks (3)  

**HIGH RISK:** 8 — cases create/update/delete/saveAll (4); claimCase; leave insert (RPC); food submitOwn (RPC); linkAuthUser  

**RPC/FUNCTION DEPENDENCIES:** 4 primary RPCs + ~6 helper functions used by RPC/RLS  

**TRIGGER DEPENDENCIES:** 5 `update_updated_at` triggers (employees, hospitals, cases, surgical_kits, petrol_requests)  

**AUTH-DEPENDENT WRITES:** 7+ (RPC trio, linkAuthUser, OTP EF pair, auth-sync EFs)  

**REQUIRES SUPABASE RESTORATION:** Case update/claim; leave/food employee submit; FCFS claim; full workflow parity suite  

**PRODUCTION SUPABASE MODIFIED:** NO  
**REMOTE D1 TOUCHED:** NO  
**DEPLOYMENT:** NO  
**WRITE MIGRATION IMPLEMENTED:** NO  
