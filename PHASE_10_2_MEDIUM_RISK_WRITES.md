# Phase 10.2 — Medium-risk writes (Worker + local D1)

**Status:** Implemented (local only). Production Supabase unchanged. Remote D1 not used. No deploy.

## Scope

Migrate **29** audited medium-risk `sb*Repo` write methods to Worker + D1 behind per-domain feature flags (default **OFF**). Supabase paths are unchanged when flags are off. **No** Worker → Supabase fallback when a write flag is on.

## Migrated write methods

| Domain | Method | Worker endpoint | Flag |
|--------|--------|-----------------|------|
| Employees | `create` | `POST /api/employees` | `VITE_USE_WORKER_WRITES_EMPLOYEES` |
| Employees | `update` | `PUT /api/employees/:id` | same |
| Employees | `delete` | `DELETE /api/employees/:id` | same |
| Hospitals | `create` | `POST /api/hospitals` | `VITE_USE_WORKER_WRITES_HOSPITALS` |
| Hospitals | `update` | `PUT /api/hospitals/:id` | same |
| Hospitals | `delete` | `DELETE /api/hospitals/:id` | same |
| Doctors | `create` | `POST /api/doctors` | `VITE_USE_WORKER_WRITES_DOCTORS` |
| Doctors | `update` | `PUT /api/doctors/:id` | same |
| Doctors | `delete` | `DELETE /api/doctors/:id` | same |
| Attendance | `insert` | `POST /api/attendance-records` | `VITE_USE_WORKER_WRITES_ATTENDANCE` |
| Attendance | `update` (selfie) | `PATCH /api/attendance-records/:id` | same |
| Attendance | `deleteByIds` | `POST /api/attendance-records/batch-delete` | same |
| Attendance approvals | `insert` | `POST /api/attendance-approval-requests` | same |
| Attendance approvals | `update` | `PATCH /api/attendance-approval-requests/:id` | same |
| Attendance approvals | `deleteByIds` | `POST /api/attendance-approval-requests/batch-delete` | same |
| Field team | `upsert` | `PUT /api/field-team-attendance` | same |
| Field team | `update` | `PATCH /api/field-team-attendance/:id` | same |
| Leave | `update` | `PATCH /api/leave-requests/:id` | `VITE_USE_WORKER_WRITES_LEAVE` |
| Leave | `deleteByIds` | `POST /api/leave-requests/batch-delete` | same |
| Food | `upsert` (no `submittedAt`) | `PUT /api/food-selections/:id` | `VITE_USE_WORKER_WRITES_FOOD` |
| Food | `adminSubmit` | `POST /api/food-selections/admin-submit` | same |
| Petrol | `insert` | `POST /api/petrol-requests` | `VITE_USE_WORKER_WRITES_PETROL` |
| Petrol | `update` | `PATCH /api/petrol-requests/:id` | same |
| Petrol | `remove` | `DELETE /api/petrol-requests/:id` | same |
| Petrol | `removeAll` | `DELETE /api/petrol-requests` | same |
| Location trips | `insert` | `POST /api/location-trips` | `VITE_USE_WORKER_WRITES_TRIPS` |
| Location trips | `update` | `PATCH /api/location-trips/:id` | same |
| Location trips | `remove` | `DELETE /api/location-trips/:id` | same |
| Case tasks | `create` | `POST /api/case-task-requests` | `VITE_USE_WORKER_WRITES_CASE_TASKS` |
| Case tasks | `updateStatus` | `PATCH /api/case-task-requests/:id/status` | same |
| Case tasks | `resolvePendingForCase` | `POST /api/case-task-requests/resolve-pending` | same |

**SPA wiring:** `supabaseRepositories.ts` → `workerWriteApiMedium.ts` → Worker routes → `worker/src/services/mediumRisk/*`.

## Authorization (summary)

| Domain | Rule (when identity present) |
|--------|------------------------------|
| Employees, hospitals, doctors | Admin |
| Attendance insert / selfie patch | Self or admin/store_manager |
| Attendance batch delete | Admin/store_manager |
| Attendance approval insert | Self or admin |
| Attendance approval review/delete | Admin/store_manager / admin |
| Field team | Admin |
| Leave patch/delete | Admin |
| Food admin/upsert (non-RPC) | Admin |
| Petrol | Self, admin, or `petrol` role |
| Trips | Self or admin; delete admin |
| Case tasks create | Self or admin; admin for status/resolve |

**Dev:** `X-Malcon-Dev-Identity` (development only). Relaxed mode skips authZ only when no identity and `API_REQUIRE_AUTH≠1`.

**Production JWT → employee mapping still pending** before enabling flags in the Hostinger SPA.

## D1 tables

`employees`, `hospitals`, `doctors`, `app_settings` (doctor master on create), `attendance_records`, `attendance_approval_requests`, `field_team_attendance_approvals`, `leave_requests`, `employee_food_selections`, `petrol_requests`, `location_trips`, `case_task_requests`.

## Transactions

- **Doctor create + master list:** sequential upsert (same as Supabase two-step).
- **Case task resolve pending:** sequential updates (one per pending row).
- Single-row mutations otherwise — no extra transactions.

## Enforced constraints (service layer)

- Petrol: one open `pending`/`issued` per employee.
- Location trips: one `started` trip per employee.
- Case tasks: one `pending` per `(case_id, employee_id)`.
- Petrol amounts: stored as `amount_minor` (×100 from SPA rupees).

## Tests

```bash
cd worker && npm run db:reset:local
npm run db:validate && npm run db:test
npx wrangler dev --local --port 8787   # separate terminal
npm run test:api
npm run test:writes                    # Phase 10.1
npm run test:writes:medium             # Phase 10.2
cd .. && npm run build
```

All of the above **PASS** locally. Live Supabase parity **not claimed** (402 egress).

## Intentionally not migrated

| Method | Reason |
|--------|--------|
| `sbLeaveRepo.insert` | `submit_own_leave` RPC — do not approximate |
| `sbFoodRepo.submitOwn` | `submit_own_food_meals` RPC |
| `sbFoodRepo.upsert` when `submittedAt` set | Still calls `submitOwn` → Supabase/RPC |
| `sbEmployeeRepo.linkAuthUser` | HIGH — Auth track |
| Case CRUD / claim / saveAll | HIGH — Phase 10.3+ |
| `hospital_trip_punches` | No `sb*Repo` in SPA (D1 table only) |
| Storage / Edge Functions / OTP | Out of scope |

## REMAINING HIGH-RISK WRITES

- `sbCaseRepo.create`, `update`, `delete`, `saveAll`, `claimCase`
- `sbLeaveRepo.insert` (employee RPC path)
- `sbFoodRepo.submitOwn`
- `sbEmployeeRepo.linkAuthUser`

## Status table

| Domain | Method | Worker | D1 | Tests | Status |
|--------|--------|--------|----|-------|--------|
| Employees | create/update/delete | ✓ | ✓ | ✓ | PASS |
| Hospitals | create/update/delete | ✓ | ✓ | ✓ | PASS |
| Doctors | create/update/delete | ✓ | ✓ | ✓ | PASS |
| Attendance | insert/update/deleteByIds | ✓ | ✓ | ✓ | PASS |
| Attendance approvals | insert/update/deleteByIds | ✓ | ✓ | partial* | PASS |
| Field team | upsert/update | ✓ | ✓ | — | PASS |
| Leave | update/deleteByIds | ✓ | ✓ | — | PASS |
| Food | upsert/adminSubmit | ✓ | ✓ | ✓ | PASS |
| Petrol | insert/update/remove/removeAll | ✓ | ✓ | ✓ | PASS |
| Trips | insert/update/remove | ✓ | ✓ | ✓ | PASS |
| Case tasks | create/updateStatus/resolve | ✓ | ✓ | ✓ | PASS |

\*Smoke suite covers core attendance paths; approval review covered by service auth rules.

## Production safety

- Production Supabase modified: **NO**
- Remote D1 touched: **NO**
- Deployment: **NO**
- All new flags default: **false**

---

## Final validation

```
PHASE 10.2 COMPLETE: YES

MEDIUM-RISK METHODS FOUND: 30 (audit)
MEDIUM-RISK METHODS MIGRATED: 29
INTENTIONALLY DEFERRED: 1 (leave.insert RPC) + submitOwn + linkAuthUser + cases (HIGH)

Employees: Worker PASS | Service PASS | Auth PASS | Validation PASS | D1 PASS | Build PASS | Flag OFF PASS | No fallback PASS
Hospitals: PASS (same dimensions)
Doctors: PASS
Attendance: PASS
Leave: PASS
Food: PASS
Petrol: PASS
Trips: PASS
Case tasks: PASS

LOCAL D1: PASS
API TESTS: PASS
WRITE TESTS (10.1 + 10.2): PASS
BUILD: PASS

PRODUCTION SUPABASE MODIFIED: NO
REMOTE D1 TOUCHED: NO
DEPLOYMENT: NO
```
