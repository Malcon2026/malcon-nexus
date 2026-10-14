# Phase 9 — Implementation plan (planning only)

**Status:** Plan only — **no implementation in this phase**  
**Context:** Production Supabase project `iaxkbiejmwnstckiggwg` is **402 / exceed_egress_quota**; existing data untouched. Phase 8 migrated **employee + case reads** behind `VITE_USE_WORKER_READS` (default `false`). Worker today: **GET-only** employees, cases, employee attendance (`worker/src/index.ts`).

**Goal:** Continue migrating remaining SPA functionality from **Browser → Supabase PostgREST / Edge Functions / Storage / Auth** to **Browser → Cloudflare Worker → D1**, without redesigning the app and **without removing Supabase** until a later cutover phase.

**Principles (carry forward from Phases 7–8):**

- Extend existing Worker layout: `routes/` → `services/` → Drizzle D1; `middleware/auth.ts`, `authorization.ts`, `lib/pagination.ts`.
- SPA: keep `supabaseRepositories.ts` as the switch point; extend `workerApi.ts` + mappers/adapters; feature flags per domain until verified.
- No silent Worker → Supabase fallback when a migration flag is on.
- Paginate list endpoints; avoid `SELECT *` on large JSON (`cases.stages`, etc.).
- Do **not** drop Supabase repos or Auth until explicitly planned.

---

## 1. Remaining Supabase reads

All paths below still hit Supabase when the Phase 8 Worker read flag is **off** (and auth paths always use Supabase today).

### 1.1 Already migrated (Phase 8, flag-gated)

| Read | Repository / entry | Supabase when flag off | Worker when flag on |
|------|-------------------|------------------------|---------------------|
| Employee list | `sbEmployeeRepo.getAll` | `employees` `select *` | `GET /api/employees` |
| Employee by id | `sbEmployeeRepo.getById` | `employees` | `GET /api/employees/:id` |
| Case list (bootstrap) | `sbCaseRepo.getAll` | `cases` `select *` (heavy) | Paginated list + detail |
| Case by id | `sbCaseRepo.getById` | `cases` | `GET /api/cases/:id` |
| Employee-scoped cases | `getForEmployee`, pool helpers | RLS-filtered PostgREST | Worker fetch + client filter (Phase 8 limitation) |

**Files:** `src/lib/database/repositories/supabaseRepositories.ts`, `src/lib/workerApi.ts`, `src/lib/workerReadAdapters.ts`, `src/lib/workerReadMappers.ts`, `src/lib/workerReadConfig.ts`, `src/lib/database/bootstrap.ts` (via repos).

### 1.2 Not migrated — bootstrap-critical (P0–P1)

| Domain | Repository methods | Table(s) | Bootstrap keys |
|--------|------------------|----------|----------------|
| Notifications | `sbNotificationRepo.getAll(recipientId?)` | `notifications` | admin/employee/store_manager essentials |
| Attendance | `getAll`, `getRecentForEmployee` | `attendance_records` | admin, employee, store_manager |
| Attendance approvals | `getAll`, `getForEmployee` | `attendance_approval_requests` | admin, employee, store_manager |
| Field team attendance | `getAll`, `getForDate` | `field_team_attendance_approvals` | admin |
| Leave | `getAll`, `getForEmployee` | `leave_requests` | admin, employee, store_manager |
| Petrol | `getAll`, `getForEmployee` | `petrol_requests` | admin, employee, petrol |
| Food | `getAll`, `getForEmployee`, `getForDateRange` | `employee_food_selections` | admin, employee |
| Location trips | `getAll`, `getForEmployee` | `location_trips` | admin, employee deferred |
| Hospitals | `sbHospitalRepo.getAll` | `hospitals` | admin, employee deferred |
| Doctors | `sbDoctorRepo.getAll` | `doctors`, `app_settings` (master list) | admin, store_manager |
| Departments | `sbDepartmentRepo.getAll` | `departments` | admin, employee deferred |
| Approvals | `sbApprovalRepo.getAll` | `approvals` | admin, store_manager |
| Case task requests | `getAll`, `getForEmployee` | `case_task_requests` | admin, employee (FCFS) |
| Kits | `sbKitRepo.getAll` | `surgical_kits` | admin/store_manager deferred |
| Activity log | `sbActivityRepo.getAll` (limit 500) | `activity_log` | admin deferred |
| Settings | `sbSettingsRepo.getAll` | `app_settings` | via store / notice board |
| Daily expenses | `sbExpenseRepo.getAll` | `employee_daily_expenses` | expenses dashboards |

**Primary file:** `src/lib/database/bootstrap.ts` (task lists: `adminEssentialTasks`, `employeeEssentialTasks`, etc.).

### 1.3 Not migrated — auth/session reads (always Supabase today)

| Read | Location | Table |
|------|----------|-------|
| `getByAuthUserId` | `sbEmployeeRepo` | `employees` |
| `getByEmail` | `sbEmployeeRepo` | `employees` |

**Files:** `src/lib/auth.ts`, `src/App.tsx` (session bootstrap).

### 1.4 Not migrated — on-demand / screen refresh reads

| Trigger | Behavior |
|---------|----------|
| `taskRepository.getFreshById` | `sbCaseRepo.getById` (Worker when Phase 8 flag on) |
| `bootstrapSupabaseData(..., { force: true })` | Full re-fetch via all bootstrap tasks |
| Pages: `LiveCases`, `CaseHistory`, `ApprovalQueue`, `TaskRequestQueue`, `WorkflowBoard`, `TvBoard`, `EmployeeDashboard` | Force bootstrap or partial reload |

**Files:** `src/pages/*.tsx`, `src/lib/database/repositories/tasks.ts`.

### 1.5 Edge Function “reads” (HTTP GET-style)

| Consumer | Function | Purpose |
|----------|----------|---------|
| `src/lib/galleryFeed.ts` | `gallery-feed` | Gallery site data |
| `src/lib/tvBoardFeed.ts` | `gallery-feed?mode=tv` | TV board cases/employees/notice |
| `src/lib/dashboardInsights.ts` | `dashboard-insights` | Admin dashboard AI/summary payload |
| `src/lib/hospitalSearch.ts` | `location-hospital-search` | Hospital autocomplete |
| `src/lib/bikeRoute.ts` | `location-bike-route` | Kms / bike route |

These are not PostgREST but still depend on Supabase Edge + often service-role queries inside the function.

### 1.6 HR/TMS

Tables exist in D1 (`worker/src/db/schema.ts`) and export tooling; **no `src/` SPA repository** yet. Phase 9 can defer unless HR UI lands in this repo.

---

## 2. Remaining Supabase writes

All mutations still go through `sb*Repo` → PostgREST (or RPC) unless `USE_SUPABASE` is false (local seed mode only).

| Domain | Repository | Operations |
|--------|------------|------------|
| Employees | `sbEmployeeRepo` | create, update, delete, `linkAuthUser` |
| Hospitals / doctors | `sbHospitalRepo`, `sbDoctorRepo` | CRUD + doctor master `app_settings` upsert |
| Cases | `sbCaseRepo` | create, update, delete, `saveAll`; **RPC** on update |
| Notifications | `sbNotificationRepo` | create, markRead, markAllRead |
| Approvals | `sbApprovalRepo` | upsert |
| Case task requests | `sbCaseTaskRequestRepo` | create, updateStatus |
| Activity | `sbActivityRepo` | insert |
| Attendance | `sbAttendanceRepo` | insert, update, deleteByIds |
| Attendance approvals | `sbAttendanceApprovalRepo` | insert, update, deleteByIds |
| Field team | `sbFieldTeamAttendanceRepo` | upsert, update |
| Leave | `sbLeaveRepo` | insert, update, deleteByIds; **RPC** `submit_own_leave` |
| Expenses | `sbExpenseRepo` | upsert, delete |
| Settings | `sbSettingsRepo` | upsert |
| Kits | `sbKitRepo` | update |
| Petrol | `sbPetrolRepo` | insert, update, delete |
| Location trips | `sbLocationTripRepo` | insert, update, delete |
| Food | `sbFoodRepo` | upsert via **RPC** `submit_own_food_meals` |

**Wrappers:** `src/lib/database/repositories/{employees,hospitals,doctors,tasks,notifications,approvals,departments,kits}.ts` → `USE_SUPABASE` branches.

**Heavy logic:** `src/store/useStore.ts` — most user actions call repository wrappers then `reloadFromDatabase()` / cache updates.

---

## 3. Supabase Auth dependencies

| Capability | Implementation | Depends on Supabase |
|------------|----------------|---------------------|
| Admin login | `authService.signIn` → `signInWithPassword` | **Yes** — Auth API |
| Employee login | OTP via `request-login-otp`, `verify-login-otp` EFs + session | **Yes** |
| Session restore | `getSession`, `onAuthStateChange` | **Yes** |
| Employee row linkage | `auth_user_id` on `employees` | **Yes** (DB column + reads) |
| Logout | `signOut` | **Yes** |
| Create/update login email | `auth-sync.ts` → EFs | **Yes** |

**Files:** `src/lib/auth.ts`, `src/lib/auth-sync.ts`, `src/pages/Login.tsx`, `src/App.tsx`, `supabase/functions/request-login-otp`, `verify-login-otp`, `create-employee-login`, `update-employee-login-email`.

**Phase 9 note:** Auth migration is a **separate track** (likely Phase 10+). Until then, Worker must accept Supabase JWT (or dev stub) and map to `RequestContext` — extend `worker/src/middleware/auth.ts` without replacing SPA login yet.

---

## 4. Supabase Storage dependencies

| Feature | File | Bucket / pattern |
|---------|------|------------------|
| Stage photos upload | `src/lib/stagePhotos.ts` | `stage-photos` upload + thumb |
| Stage photo view | `src/lib/stagePhotos.ts` | signed URL (super-admin RLS in PG) |
| Attendance selfie upload | `src/lib/attendanceSelfie.ts` | EF `upload-attendance-selfie` (not direct bucket from browser for upload path) |

**No Worker/R2 equivalent yet.** D1 stores URLs in JSON/`selfie_url` columns; blobs stay in Supabase Storage today.

---

## 5. Supabase Edge Function dependencies

Functions under `supabase/functions/` (SPA or ops relevance):

| Function | Called from | Role |
|----------|-------------|------|
| `request-login-otp` | `auth.ts` | Employee auth |
| `verify-login-otp` | `auth.ts` | Employee auth |
| `create-employee-login` | `auth-sync.ts` | Admin HR |
| `update-employee-login-email` | `auth-sync.ts` | Admin HR |
| `send-assignment-email` | `email.ts` | Notifications |
| `send-telegram` | `telegram.ts` | Messaging |
| `telegram-broadcast` | `telegramBroadcast.ts` | Admin broadcast |
| `push-subscribe` | `webPush.ts` | PWA |
| `send-push` | `webPush.ts` | PWA |
| `upload-attendance-selfie` | `attendanceSelfie.ts` | Attendance |
| `upload-stage-photo` | (server-side from EF pattern; SPA uses storage SDK) | Cases |
| `location-hospital-search` | `hospitalSearch.ts` | Case create |
| `location-bike-route` | `bikeRoute.ts` | Kms dashboard |
| `dashboard-insights` | `dashboardInsights.ts` | Dashboard |
| `gallery-feed` | `galleryFeed.ts`, `tvBoardFeed.ts`, `public/gallery` | Gallery/TV |
| `gallery` | Gallery static | Photos |
| `tv-board-feed` | Legacy/alternate TV | TV |
| `start-case-alerts`, `acknowledge-case-alerts`, `process-alert-escalations`, `test-case-alerts` | `caseAlerts.ts` | Alert pipeline |
| `telegram-webhook` | External Telegram | Webhook |

**Phase 9:** Port read-heavy feeds to Worker first; keep write/send functions on Supabase until messaging secrets and R2 are planned.

---

## 6. Remaining direct Supabase calls (outside repositories)

| Location | Usage |
|----------|--------|
| `src/lib/supabase.ts` | Client singleton |
| `src/lib/database/storage.ts` | `bootstrapFromSupabase` bulk `select *` per table (legacy path) |
| `src/lib/auth.ts` | Auth + EF fetch for OTP |
| `src/lib/*` helpers listed in §5 | `functions.invoke` / fetch |
| `src/lib/stagePhotos.ts` | Storage SDK |

Repositories centralize most PostgREST; **new Worker wiring should stay in repos + workerApi**, not new scattered calls.

---

## 7. RLS-dependent authorization (must be replicated in Worker)

Today enforced in PostgreSQL RLS + RPC; SPA assumes failures surface as PostgREST errors.

| Area | SPA assumption | Worker action |
|------|----------------|---------------|
| Case visibility | Employee sees assigned + stage assignee/assistant rows | Implement `canReadCase` (started in `worker/src/middleware/authorization.ts`); add **server-side filters** for list endpoints (replace Phase 8 client-side full fetch) |
| Case updates | `save_case_for_session` RPC + RLS on direct update | Port RPC logic to Worker service transaction |
| Employee self-service | Leave/food RPCs | Port validation + row ownership in Worker |
| Stage photos | Super-admin allowlist (`src/lib/superAdmin.ts` + PG policy) | Worker signed URLs + role check |
| Notifications | Recipient scoping | Filter by `recipient_id` / employee |
| Attendance | Employee vs admin register | Scope by `employee_id` |
| Petrol book uniqueness | DB constraints + app checks | Preserve in Worker writes |

**Reference:** `supabase/schema.sql`, `supabase/migrations/*rls*`, `PHASE_4_SUPABASE_TO_D1_MIGRATION_PLAN.md` §RLS.

---

## 8. RPC / Postgres function dependencies

| RPC | Used in | Phase 9 port target |
|-----|---------|---------------------|
| `save_case_for_session` | `sbCaseRepo.update` | `worker/src/services/cases.ts` write path |
| `sync_case_header_from_stages` | case update retry | Same service |
| `submit_own_leave` | `sbLeaveRepo` | `services/leave.ts` |
| `submit_own_food_meals` | `sbFoodRepo` | `services/food.ts` |

Read SQL definitions from migrations; **do not call Supabase RPC from Worker**.

---

## 9. Realtime / polling dependencies

| Pattern | Location | Notes |
|---------|----------|-------|
| Supabase Realtime | — | **Not used** in `src/` (no `channel` / `postgres_changes`) |
| Bootstrap refresh | Multiple pages call `bootstrapSupabaseData({ force: true })` | Full-table re-download risk |
| TV board polling | `TvBoard.tsx` `setInterval` 2.5s overflow check | UI only; data from store/cache |
| Attendance UI timers | `setInterval` 1s clock | Not data polling |
| Session cache TTL | `bootstrapSessionCache.ts` 5 min | Skips network when fresh |

**Phase 9:** When migrating reads, avoid replacing one giant bootstrap with another giant Worker fetch; use **paginated Worker bootstrap tasks** aligned with Phase 7 performance notes.

---

## 10. Large-egress operations to redesign (do not copy blindly)

| Operation | Risk | Target design |
|-----------|------|----------------|
| `sbCaseRepo.getAll` `select *` | Huge JSON per case | Already mitigated on Worker list+detail; **remove full bootstrap case download** when Worker default |
| `sbNotificationRepo.getAll` | ~73k rows in production export | Paginated `GET /api/notifications?recipient=&page=`; bootstrap cap |
| `sbAttendanceRepo.getAll` admin | Full table | Date-range + pagination; admin dashboard filters |
| `sbActivityRepo.getAll` limit 500 | Moderate | Cursor pagination |
| `bootstrapSupabaseData({ force: true })` on tab open | Repeat full egress | Targeted refresh endpoints |
| `gallery-feed` / TV feed | Bulk cases + employees | Worker aggregated feed with If-None-Match / `updatedSince` |
| `dashboard-insights` | LLM + wide queries | Optional; rate-limit; narrow SQL in Worker |
| Employee `getAll` `select *` | Sensitive columns | Worker already omits `auth_user_id`; keep explicit column lists |

---

## 11. Recommended migration order

Sub-phases are **sequential**; each ends with local D1 + Worker tests and flag-gated SPA wiring before the next.

### Phase 9.0 — Gate (prerequisite)

- Restore Supabase egress; complete **authenticated** Phase 8 browser validation (`scripts/phase8-spa-browser-validation.mjs` extended for post-login bootstrap/UI — not a new validator).
- **Blocker:** 402 today.

### Phase 9.1 — Read migration: reference + bootstrap (P0/P1)

1. **Notifications** (paginated) — unblocks every role dashboard.
2. **Hospitals, doctors, departments** — case create/edit, employee deferred load.
3. **App settings** (read subset: notices, incentives) — TV/notice board.
4. **Approvals, case task requests** — admin queues.

**Worker:** new GET routes + services; **SPA:** extend `workerApi.ts`, branch in `supabaseRepositories.ts`, optional `VITE_USE_WORKER_READS_NOTIFICATIONS` or expand single flag per team preference (document in Phase 9.1).

### Phase 9.2 — Read migration: operations data (P1)

5. **Attendance** (employee scoped + admin paginated) — extend existing `GET .../attendance` patterns.
6. **Attendance approvals, field team approvals**
7. **Leave, petrol, food, location trips**
8. **Daily expenses** (read)
9. **Surgical kits, activity log** (deferred admin)

**Bootstrap:** split heavy tasks to deferred tier with Worker pagination.

### Phase 9.3 — Case/employee read hardening (P0 tech debt)

10. **Server-side case list filters** (`assignee`, pool) — replace Phase 8 “fetch all cases + filter”.
11. **`/api/me`** or auth-scoped employee lookup for post-login (still backed by D1; session still Supabase JWT).

### Phase 9.4 — Write migration: low-risk entities (P1)

12. **Notifications** mark read/create (internal).
13. **Activity log** append.
14. **Settings** patch (admin).
15. **Departments/kits** patch (admin).

Uses Worker POST/PATCH; **dual-write not required** until cutover — flag `VITE_USE_WORKER_WRITES_*` per domain.

### Phase 9.5 — Write migration: core workflow (P0/P1)

16. **Cases** create/update/delete — port RPC logic; highest risk.
17. **Employees** CRUD (admin) — coordinate with Auth EFs still on Supabase.
18. **Hospitals/doctors** CRUD.
19. **Approvals, case task requests, attendance punches/approvals, leave, food, petrol, trips, expenses**

### Phase 9.6 — Edge-adjacent (P2)

20. **Hospital search / bike route** → Worker routes (or keep external APIs behind Worker proxy).
21. **Gallery/TV feed** → Worker (read-only aggregate).
22. **Dashboard insights** → defer or isolate (optional OpenAI key in Worker secrets).

### Phase 9.7 — Storage & media (P2, likely Phase 10 overlap)

23. **R2** (or compatible) for stage photos + selfies; Worker presigned upload/download; super-admin rules.

### Phase 9.8 — Auth & cutover prep (later)

24. Supabase Auth remains until OTP/Telegram and admin provisioning have a Worker story.
25. Remote D1 staging, read-only prod validation, Hostinger env flip — **not Phase 9**.

---

## 12. Dependencies / blockers per track

| Track | Blockers |
|-------|----------|
| Any Supabase-mode validation | **402 egress** — must restore project or use non-prod Supabase |
| Phase 8 sign-off | Authenticated SPA bootstrap + network proof |
| Worker reads | Local D1 data (seed or Phase 6 import); `wrangler dev --local` |
| Worker writes | Port RPC + RLS rules; integration tests; no prod D1 until planned |
| Auth in Worker | Valid JWT from Supabase Auth; map `sub` → `employees.auth_user_id` |
| Storage migration | R2 bucket, CORS, migration of existing objects (read-only from Supabase when restored) |
| Edge functions | Secrets (Resend, Telegram, VAPID, OpenAI) in Worker env |
| HR/TMS | Real column schema in D1 if SPA added |

---

## 13. Safe to migrate while Supabase is unavailable (402)

| Work | Why safe |
|------|----------|
| Worker GET/POST route implementation against **local D1** | No prod Supabase calls |
| Drizzle services + authorization unit tests | Local only |
| SPA Worker client + repo branches behind **default-off flags** | Build/test with local Vite + Worker |
| Pagination/performance fixes in Worker services | Already validated Phase 7 |
| Import/regression scripts on local JSONL | Existing Phase 6 tooling |
| Documentation, OpenAPI-style mapping updates | No runtime dependency |

**Cannot fully verify:** Supabase-mode parity, login, OTP, Storage uploads, production email/Telegram/push.

---

## 14. Requires Supabase temporarily restored

| Activity | Reason |
|----------|--------|
| Phase 8/9.0 final browser validation | Auth + PostgREST baseline |
| Dual-run comparison (Supabase vs Worker) | Same live data |
| Production export refresh | `scripts/export-production-data.mjs` |
| Storage migration planning | List/copy objects from buckets |
| Auth EF testing (OTP, create login) | Live Auth + `login_otps` |
| Validating RLS parity during case write port | Compare error cases |

---

## 15. Files / components likely to change (by sub-phase)

### 9.1 Reference reads

| Layer | Files |
|-------|--------|
| Worker | `worker/src/index.ts`, `worker/src/routes/notifications.ts`, `hospitals.ts`, `doctors.ts`, `departments.ts`, `settings.ts`, `approvals.ts`, `case-task-requests.ts`, matching `services/*` |
| SPA | `supabaseRepositories.ts`, `workerApi.ts`, `workerReadMappers.ts`, `workerReadAdapters.ts`, `workerReadConfig.ts`, `bootstrap.ts` (no structural change — repos only) |
| Tests | `worker/scripts/test-api-local.mjs`, extend `scripts/phase8-spa-browser-validation.mjs` |

### 9.2 Operations reads

| Layer | Files |
|-------|--------|
| Worker | `routes/attendance*.ts`, `leave.ts`, `petrol.ts`, `food.ts`, `location-trips.ts`, `expenses.ts`, `activity-log.ts`, `kits.ts` |
| SPA | Same repo switch pattern; `useStore.ts` only if new refresh helpers needed |
| Pages | `Attendance.tsx`, `EmployeeDashboard.tsx`, `Expenses.tsx`, `PetrolDashboard.tsx`, `FoodDashboard.tsx`, `KmsDashboard.tsx`, `ActivityLog.tsx` — **only if** they bypass cache today (audit before edit) |

### 9.3 Case list hardening

| Layer | Files |
|-------|--------|
| Worker | `services/cases.ts`, `routes/cases.ts` (query params), `authorization.ts` |
| SPA | Remove full-case client filter in `supabaseRepositories.ts` Worker branches; `workerApi.ts` |

### 9.4–9.5 Writes

| Layer | Files |
|-------|--------|
| Worker | New POST/PATCH/DELETE handlers; transactional services; `lib/http.ts` error shape |
| SPA | `repositories/*.ts` wrappers, `useStore.ts` mutation paths, keep `ImplantCase` / `Employee` shapes |
| Avoid | Rewriting `pages/*` unless response shape requires it |

### 9.6 Feeds

| Layer | Files |
|-------|--------|
| Worker | `routes/gallery-feed.ts`, `routes/tv-feed.ts` |
| SPA | `galleryFeed.ts`, `tvBoardFeed.ts`, `pages/TvBoard.tsx`, `gallery-main.tsx` |
| Static | `public/gallery/index.html` (URL config) |

### 9.7 Storage

| Layer | Files |
|-------|--------|
| Worker | upload/sign routes, R2 bindings in `wrangler.toml` (**staging only until approved**) |
| SPA | `stagePhotos.ts`, `attendanceSelfie.ts` |

### Auth (later)

| Layer | Files |
|-------|--------|
| SPA | `auth.ts`, `Login.tsx`, `App.tsx` |
| Worker | `middleware/auth.ts`, `api-auth.ts` |

---

## Worker API architecture (keep)

```
Request → index.ts router
        → api-auth (JWT / dev stub)
        → authorization.ts (RLS equivalent)
        → routes/*.ts (parse query/body)
        → services/*.ts (Drizzle + business rules)
        → D1
```

Extend incrementally; **do not** replace with GraphQL or a second ORM. Reuse `lib/pagination.ts` response shape `{ data: { items, pagination } }` consistent with Phase 7.

---

## Phase 8 carry-over into Phase 9.0

Before 9.1:

- [ ] Supabase **AVAILABLE** (not 402)
- [ ] Run full browser validation with **logged-in bootstrap** and Employees/Cases UI navigation
- [ ] Optionally flip `VITE_USE_WORKER_READS=true` in local only after parity signed off
- [ ] Document known Phase 8 limitation: employee case pool filtering until 9.3

---

## Summary table (migration surface)

| Category | Remaining on Supabase | Phase 9 primary action |
|----------|----------------------|-------------------------|
| Reads | ~15 repo domains + EF feeds | Worker GET + flags |
| Writes | All repo mutations + 3 RPCs | Worker POST/PATCH + port RPC logic |
| Auth | Full login/session | Stay; JWT validation in Worker only |
| Storage | Stage photos, selfies | Plan R2; later phase |
| Edge Functions | 22 functions | Replace reads first; sends later |
| Realtime | None | N/A |

---

PHASE 9 PLAN COMPLETE: **YES**  
IMPLEMENTATION STARTED: **NO**  
PRODUCTION SUPABASE MODIFIED: **NO**  
REMOTE D1 TOUCHED: **NO**  
DEPLOYMENT: **NO**
