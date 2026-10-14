# Phase 8 — Read migration map

Audit of SPA read paths (Supabase today). **Migrated in Phase 8** = employees + cases when `VITE_USE_WORKER_READS=true`.

| Area | Current (SPA → Supabase) | Target (SPA → Worker → D1) | Priority | Phase 8 status |
|------|--------------------------|------------------------------|----------|----------------|
| Login / session employee | `sbEmployeeRepo.getByAuthUserId`, `getByEmail` | Supabase (unchanged) | P0 | **Not migrated** (auth) |
| Bootstrap employees (admin) | `sbEmployeeRepo.getAll()` | `GET /api/employees` | P0 | **Migrated** (flag) |
| Bootstrap employees (employee) | `sbEmployeeRepo.getById(id)` | `GET /api/employees/:id` | P0 | **Migrated** (flag) |
| Bootstrap cases (admin) | `sbCaseRepo.getAll()` | Paginated `GET /api/cases` + `GET /api/cases/:id` | P0 | **Migrated** (flag) |
| Bootstrap cases (employee) | `getCasesForEmployeeIncludingPool` | Worker case fetch + client filter | P0 | **Migrated** (flag) |
| Case detail / fresh read | `sbCaseRepo.getById`, `taskRepository.getFreshById` | `GET /api/cases/:id` | P0 | **Migrated** (flag) |
| Notifications | `sbNotificationRepo.getAll` | TBD `/api/notifications` | P0 | Not migrated |
| Hospitals / doctors | `sbHospitalRepo`, `sbDoctorRepo.getAll` | TBD | P1 | Not migrated |
| Attendance | `sbAttendanceRepo.*` | TBD | P1 | Not migrated |
| Activity log | `sbActivityRepo.getAll` (limit 500) | TBD paginated | P2 | Not migrated |
| Departments / kits / approvals | various `getAll` | TBD | P1–P2 | Not migrated |
| HR/TMS | not in main bootstrap | TBD | P3 | Not migrated |
| Petrol / leave / trips / food | employee bootstrap deferred | TBD | P1 | Not migrated |

**Bootstrap entry:** `src/lib/database/bootstrap.ts` (no direct Supabase imports; all via `sb*Repo`).

| Bootstrap task key | Repository read | Worker in Phase 8? |
|--------------------|-----------------|-------------------|
| `employees` | `sbEmployeeRepo.getAll()` | Yes (flag) |
| `employees` (employee login) | `sbEmployeeRepo.getById` | Yes (flag) |
| `cases` | `sbCaseRepo.getAll()` | Yes (flag) |
| `cases` (employee) | `getCasesForEmployeeIncludingPool` | Yes (flag; single case fetch + filter) |
| `notifications` | `sbNotificationRepo.getAll` | No |
| `hospitals` / `doctors` | hospital/doctor repos | No |
| `attendance` / approvals / leave / petrol / food / trips | respective repos | No |
| `activityLog` | `sbActivityRepo.getAll` | No |
| `departments` / `kits` / `settings` | respective repos | No |

**Other read entry points:** `src/lib/auth.ts` (employee by auth/email — Supabase). `taskRepository.getFreshById` → `sbCaseRepo.getById` (Worker when flag). Post-bootstrap reads use in-memory cache, not Supabase.

**Writes:** All create/update/delete remain Supabase (`sb*Repo` mutations unchanged).

**Completion (2026-10-14):** Employee + case read routing implemented in `supabaseRepositories.ts`; client in `src/lib/workerApi.ts`; flag default `false`.
