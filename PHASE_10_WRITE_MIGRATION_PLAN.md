# Phase 10 — Write migration plan (planning only)

**Status:** Plan + audit only — **no write implementation**  
**Context:** Read migration complete (Phases 8, 9.1–9.4). All mutations still go to **Supabase PostgREST**, Edge Functions, Auth, or Storage unless `USE_SUPABASE` is false (local seed).

**Target architecture:**

```text
Browser SPA → Worker API (authZ) → service layer → Drizzle → D1
```

D1 is never exposed to the browser. Authorization currently enforced by **PostgreSQL RLS + SECURITY DEFINER RPCs** must be reimplemented in Worker middleware/services.

---

## 0. Prerequisites (gate)

| Gate | Why |
|------|-----|
| Restore Supabase egress (402) or dedicated staging project | Parity tests for case RPC, leave/food RPC, FCFS claim, employee handoffs |
| Phase 9 read flags validated in staging | Writes assume reads can already hit Worker/D1 |
| JWT mapping `auth.uid()` → `employees.auth_user_id` in Worker | Required for employee-scoped writes without migrating Auth yet |
| Documented rollback: **write flags OFF** → Supabase-only | No silent Worker → Supabase on failure |

**Do not enable production D1 writes** until dual-validation checklist passes.

---

## 1. Feature-flag strategy

Per-domain flags (default **false**), SPA continues to call `sb*Repo` when off:

| Flag (proposed) | Domain |
|-----------------|--------|
| `VITE_USE_WORKER_WRITES_NOTIFICATIONS` | Notification create / mark read |
| `VITE_USE_WORKER_WRITES_ACTIVITY` | Activity log append |
| `VITE_USE_WORKER_WRITES_SETTINGS` | `app_settings` patch |
| `VITE_USE_WORKER_WRITES_KITS` | Surgical kit status |
| `VITE_USE_WORKER_WRITES_EXPENSES` | Daily expenses |
| `VITE_USE_WORKER_WRITES_APPROVALS` | Stage approval queue upsert |
| `VITE_USE_WORKER_WRITES_ATTENDANCE` | Punches, approvals, field team |
| `VITE_USE_WORKER_WRITES_LEAVE_FOOD` | Leave + food selections |
| `VITE_USE_WORKER_WRITES_PETROL_TRIPS` | Petrol + location trips |
| `VITE_USE_WORKER_WRITES_CASE_TASKS` | Case task requests |
| `VITE_USE_WORKER_WRITES_REFERENCE` | Hospitals, doctors, employees CRUD |
| `VITE_USE_WORKER_WRITES_CASES` | Case create/update/delete/claim |

**No silent fallback** when a write flag is on.

Optional later: `VITE_USE_WORKER_WRITES_DUAL` for cutover window (not required for first pass).

---

## 2. Recommended migration order

### 10.1 — Infrastructure (no user-visible cutover)

- Worker: `POST/PATCH/DELETE` route pattern, idempotency keys where needed, transaction helper (D1 batch).
- Extend `middleware/auth.ts` + `authorization.ts` for **write** rules per table.
- Integration tests against **local D1** + synthetic fixtures (Phase 6/7 style).
- **Out of scope:** Auth provider migration, Storage, Edge Function replacement.

### 10.2 — Low-risk standalone writes

1. **Activity log** — `POST /api/activity-log` (append-only).  
2. **Notifications** — `POST /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`.  
3. **App settings** — `PATCH /api/settings/:key` (admin).  
4. **Surgical kits** — `PATCH /api/surgical-kits/:id` (status / last used).  
5. **Daily expenses** — `PUT /api/daily-expenses/:id`, `DELETE /api/daily-expenses/:id` (admin).  
6. **Approvals queue** — `PUT /api/approvals/:id` (upsert semantics).

**Why first:** No RPC, minimal RLS, little cross-table logic; easy rollback.

### 10.3 — Employee self-service operations (medium)

7. **Attendance punch** — `POST /api/attendance-records`, `PATCH` (selfie URL only), admin `DELETE` batch.  
8. **Attendance approval requests** — insert + admin review updates.  
9. **Field team attendance** — upsert by `(employee_id, date_key)`.  
10. **Leave** — port `submit_own_leave` validation; admin approve/reject updates.  
11. **Food** — port `submit_own_food_meals` (one update window); admin override path.  
12. **Petrol** — insert/update; respect partial unique “one open per employee”.  
13. **Location trips** — insert/update/delete; “one open trip” unique index.

**Transaction needs:** Food/leave employee submit (read employee + insert); petrol open-request check.

### 10.4 — Queues and admin workflows

14. **Case task requests** — create, `PATCH` status, **resolve pending for case** (multi-row transaction).  
15. **Reference CRUD** — hospitals, doctors (+ doctor master list in `app_settings`), employees ( **excluding** Auth provisioning).

**Defer:** `linkAuthUser` and `auth-sync` Edge Functions until Auth track.

### 10.5 — Case workflow (high risk — last)

16. **Case create** — insert with FK checks, snapshots JSON.  
17. **Case update** — replace `save_case_for_session` + `sync_case_header_from_stages` in Worker transaction (stages JSON + header sync).  
18. **Case delete** — admin only; FK cascade awareness.  
19. **FCFS claim** — conditional update (`assigned_employee_id IS NULL`) + stage mutation; port `employee_can_claim_fcfs_case`.

**Requires Supabase parity tests** before any prod flag.

### 10.6 — Explicitly deferred (not Phase 10 write scope)

| Item | Track |
|------|--------|
| Supabase Auth (OTP, admin password, session) | Phase 11+ |
| Storage (stage photos, petrol receipts, selfies) | Phase 11+ / R2 |
| Edge: messaging, alerts pipeline, dashboard-insights writes | Keep on Supabase or separate Worker secrets project |
| `departmentRepository` local-only writes | No Supabase today |
| Generic `SupabaseStorageProvider._persist` upsert | Legacy; avoid expanding |

---

## 3. Proposed Worker API surface (summary)

| Method | Path | Service |
|--------|------|---------|
| POST | `/api/activity-log` | `activityWrites.ts` |
| POST/PATCH | `/api/notifications` … | `notificationWrites.ts` |
| PATCH | `/api/settings/:key` | `settingsWrites.ts` |
| PATCH | `/api/surgical-kits/:id` | `kitWrites.ts` |
| PUT/DELETE | `/api/daily-expenses/:id` | `expenseWrites.ts` |
| PUT | `/api/approvals/:id` | `approvalWrites.ts` |
| POST/PATCH/DELETE | `/api/attendance-records` … | `attendanceWrites.ts` |
| POST/PATCH | `/api/attendance-approval-requests` … | same |
| PUT | `/api/field-team-attendance` | same |
| POST/PATCH/DELETE | `/api/leave-requests` … | `leaveWrites.ts` |
| POST/PATCH | `/api/food-selections` … | `foodWrites.ts` |
| POST/PATCH | `/api/petrol-requests` … | `petrolWrites.ts` |
| POST/PATCH/DELETE | `/api/location-trips` … | `tripWrites.ts` |
| POST/PATCH | `/api/case-task-requests` … | `caseTaskWrites.ts` |
| POST/PATCH/DELETE | `/api/hospitals`, `/api/doctors`, `/api/employees` | `referenceWrites.ts` |
| POST/PATCH/DELETE | `/api/cases`, `/api/cases/:id/claim` | `caseWrites.ts` |

All routes: `buildAuthContext` → `enforceApiAuth` → role/row checks → service → Drizzle.

---

## 4. Validation & authorization (cross-cutting)

| Concern | Worker action |
|---------|----------------|
| RLS | Explicit `requireRole`, `requireEmployeeAccess`, `canWriteCase`, FCFS helpers |
| RPC logic | Port SQL from `supabase/migrations/sync-case-header-from-stages.sql`, `add-submit-own-leave.sql`, `fix-food-employee-submit-rpc.sql` into TypeScript + D1 SQL |
| Triggers (`update_updated_at`) | Set `updated_at` in service layer (D1 has no equivalent trigger unless added) |
| Partial unique indexes | Enforce in service before insert (petrol open, food per day, expenses per day, case task pending) |
| JSON stages | Validate schema; atomic read-modify-write in transaction |
| Idempotency | Notification/activity inserts by client id; claim case with conditional update |
| Side effects | Today: `useStore` logs activity, sends telegram/email/push **after** DB write — keep ordering in SPA or move to Worker outbox later |

---

## 5. Testing plan (local D1 only until staging)

For each migrated write domain:

1. Worker unit/integration test (happy path + forbidden role).  
2. SPA harness or scripted flow with write flag ON (no Supabase duplicate).  
3. **Parity** (when Supabase available): same input → compare row shape on PG vs D1 (staging).  
4. Regression: flag OFF → Supabase path unchanged.

Case domain additionally: employee handoff, assignee blocked + sync header, FCFS claim race.

---

## 6. Rollback strategy

1. Turn off domain write flag in Hostinger env.  
2. SPA immediately uses `sb*Repo` PostgREST again.  
3. D1 rows written during experiment remain; **no automatic back-sync** to Supabase unless a one-off script is run (out of scope).  
4. Production cutover only after staged dual-run or maintenance window.

---

## 7. Production safety (this phase)

| Item | Status |
|------|--------|
| Production Supabase modified | **NO** |
| Remote D1 touched | **NO** |
| Deployment | **NO** |
| Write migration implemented | **NO** |

See **PHASE_10_WRITE_AUDIT.md** for per-operation detail.
