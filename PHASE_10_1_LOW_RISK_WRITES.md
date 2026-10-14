# Phase 10.1 — Low-risk writes (Worker + local D1)

**Status:** Implemented (local only). Production Supabase unchanged. Remote D1 not used. No deploy.

## Migrated writes (9 / 9)

| # | Supabase repo method | Table | Worker endpoint | Feature flag |
|---|----------------------|-------|-----------------|--------------|
| 1 | `sbActivityRepo.insert` | `activity_log` | `POST /api/activity-log` | `VITE_USE_WORKER_WRITES_ACTIVITY` |
| 2 | `sbNotificationRepo.create` | `notifications` | `POST /api/notifications` | `VITE_USE_WORKER_WRITES_NOTIFICATIONS` |
| 3 | `sbNotificationRepo.markRead` | `notifications` | `PATCH /api/notifications/:id/read` | `VITE_USE_WORKER_WRITES_NOTIFICATIONS` |
| 4 | `sbNotificationRepo.markAllRead` | `notifications` | `POST /api/notifications/mark-all-read` | `VITE_USE_WORKER_WRITES_NOTIFICATIONS` |
| 5 | `sbSettingsRepo.set` | `app_settings` | `PATCH /api/settings/:key` | `VITE_USE_WORKER_WRITES_SETTINGS` |
| 6 | `sbKitRepo.update` | `surgical_kits` | `PATCH /api/surgical-kits/:id` | `VITE_USE_WORKER_WRITES_KITS` |
| 7 | `sbExpenseRepo.upsert` | `employee_daily_expenses` | `PUT /api/daily-expenses/:id` | `VITE_USE_WORKER_WRITES_EXPENSES` |
| 8 | `sbExpenseRepo.delete` | `employee_daily_expenses` | `DELETE /api/daily-expenses/:id` | `VITE_USE_WORKER_WRITES_EXPENSES` |
| 9 | `sbApprovalRepo.upsert` | `approvals` | `PUT /api/approvals/:id` | `VITE_USE_WORKER_WRITES_APPROVALS` |

**SPA wiring:** `src/lib/database/repositories/supabaseRepositories.ts` branches on flags → `src/lib/workerWriteApi.ts` → Worker. **No** Worker → Supabase fallback when a write flag is on.

**Callers (unchanged):** `useStore` (activity, notifications, settings, expenses), `notificationRepository.update` → `markRead`, `approvalRepository` → `upsert`. `markAllRead` and `sbKitRepo.update` remain available on the repo; UI today uses per-notification updates for “mark all” and does not call kit update yet.

## Authorization (Worker)

| Write | Rule (when identity present) |
|-------|--------------------------------|
| Activity insert | Authenticated user (mirrors `activity_employee_insert`) |
| Notification create | Admin, or recipient matches `recipientId` |
| Mark read / mark all | Admin, or `recipientId` matches caller employee |
| Settings | Admin only |
| Kit patch | Admin only |
| Expense upsert/delete | Admin only |
| Approval upsert | Admin, employee, or store_manager |

**Local dev:** If `ENVIRONMENT=development` and `API_REQUIRE_AUTH≠1`, requests **without** identity skip authZ (integration tests). **`X-Malcon-Dev-Identity`** (base64 JSON: `authUserId`, `employeeId`, `role`) enforces rules in development only — not for production.

**Production cutover gate:** Supabase JWT verification in `middleware/auth.ts` must map to `employees.auth_user_id` before enabling write flags with strict auth.

## Validation & FKs

- UUID validation on most ids; surgical kits accept seed-style ids via `isEntityId`.
- Notification `case_id` / `recipient_id`, expense `employee_id`, approval `case_id` validated against D1.
- Settings upsert by primary key `key` (same as Supabase upsert).
- Expense upsert by `id`; unique `(employee_id, expense_date)` preserved at DB level.
- Approval upsert on `id` conflict (same as Supabase `onConflict: 'id'`).
- Activity `created_at` set server-side (Supabase default/trigger equivalent).
- Notification `created_at` set server-side on create.

## Transactions

**N/A** — each audited operation is a single D1 statement (or single upsert). No multi-table transactions added.

## Idempotency

- Settings / expense / approval upserts: safe repeat by primary key.
- Activity / notification create: duplicate `id` → D1 error (no silent success).
- Mark read: idempotent update.
- Mark all read: idempotent bulk update.

## Tests (local)

| Command | Purpose |
|---------|---------|
| `cd worker && npm run db:reset:local` | Fresh local D1 + seed |
| `npm run db:validate` | Schema checks |
| `npm run db:test` | D1 integration tests |
| `npx wrangler dev --local --port 8787` | Worker API |
| `npm run test:api` | Phase 7 read API regression |
| `npm run test:writes` | Phase 10.1 write tests (`scripts/test-low-risk-writes.mjs`) |
| `npm run build` (repo root) | SPA build |

**Supabase parity:** Not run (production 402 / egress). Behavior compared to audited Supabase repo implementations and local D1 results.

## Limitations

- Write flags default **OFF**; Supabase path unchanged when off.
- Browser does not send Worker auth yet; enabling write flags in the SPA without JWT wiring would rely on dev-open Worker auth — **do not enable in production** until JWT lands.
- `markAllRead` not used by current UI (bulk read uses repeated `markRead`).
- Medium/high-risk writes, Auth, Storage, Edge Functions, cases, leave/food RPCs: **not migrated** (Phase 10.2+).

## Deferred

None of the 9 low-risk audit items were deferred. Employee-scoped approval insert rules (case assignment) are simplified to role check until JWT + employee context is wired for strict parity.

---

## Final report

```
PHASE 10.1 COMPLETE: YES

LOW-RISK WRITES FOUND: 9
LOW-RISK WRITES MIGRATED: 9

FOR EACH WRITE:
sbActivityRepo.insert — PASS
sbNotificationRepo.create — PASS
sbNotificationRepo.markRead — PASS
sbNotificationRepo.markAllRead — PASS
sbSettingsRepo.set — PASS
sbKitRepo.update — PASS
sbExpenseRepo.upsert — PASS
sbExpenseRepo.delete — PASS
sbApprovalRepo.upsert — PASS

WORKER API: PASS
AUTHORIZATION: PASS (local dev identity + role rules; JWT deferred)
VALIDATION: PASS
TRANSACTIONS: N/A
FEATURE FLAGS: PASS
NO SILENT FALLBACK: PASS
DUPLICATE WRITE CHECK: PASS
LOCAL D1 TESTS: PASS
BUILD: PASS

PRODUCTION SUPABASE MODIFIED: NO
REMOTE D1 TOUCHED: NO
DEPLOYMENT: NO
```
