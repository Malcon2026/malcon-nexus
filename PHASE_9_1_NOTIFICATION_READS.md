# Phase 9.1 — Notification reads (Worker + local D1)

## Scope

**Migrated:** notification **read** path only (`sbNotificationRepo.getAll`).  
**Not migrated:** `markRead`, `markAllRead`, `create` (writes remain Supabase).

## Original Supabase reads

| Entry | Behavior |
|-------|----------|
| `sbNotificationRepo.getAll(recipientId?)` | `select *` from `notifications`, ordered by `created_at` desc |
| Employee bootstrap | `.eq('recipient_id', id).limit(300)` |
| Admin bootstrap | **No limit** (full table — egress risk ~73k rows) |

**Call sites:**

- `src/lib/database/bootstrap.ts` — `notifications` task (admin, employee, store_manager, deferred employee)
- Indirect: cache via `supabaseStorage.seedCache`; UI reads from `useStore` after bootstrap (`TopBar`, `EmployeeDashboard`)

No separate unread-count API; unread is `notifications.filter(n => !n.read)` client-side.

## Worker endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notifications` | Paginated list |
| GET | `/api/notifications/summary` | `total` + `unread` counts (optional; UI still uses loaded list today) |

**Query params (list):**

- `page`, `pageSize` (max 100, via `parsePagination`)
- `recipientId` (optional UUID filter)
- `unreadOnly=true` (optional)

**Columns (explicit):** `id`, `title`, `message`, `type`, `is_read`, `case_id`, `recipient_id`, `created_at`

**Response shape:** `{ data: { items: [...], pagination: { page, pageSize, total, totalPages } } }`

## Bootstrap caps (Worker mode)

Avoid full-table download:

| Context | Cap |
|---------|-----|
| Employee (`recipientId` set) | **300** (matches Supabase employee limit) |
| Admin (no filter) | **500** (bounded; does not load entire production table) |

Implementation: `getAllNotificationsViaWorker()` in `src/lib/workerApi.ts` paginates until cap or last page.

## Feature flag

| Variable | Default |
|----------|---------|
| `VITE_USE_WORKER_NOTIFICATION_READS` | `false` |

When **false:** Supabase PostgREST only for `getAll`.  
When **true:** Worker only; errors propagate (**no** silent Supabase fallback).

Independent of `VITE_USE_WORKER_READS` (employees/cases).

## Authorization

Same as Phase 7–8: dev Worker allows anonymous `/api/*`; `authorization.ts` ready for JWT phase. List filters applied via query params (recipient scoping matches current Supabase query shape).

## Files changed

**Worker**

- `worker/src/services/notifications.ts` (new)
- `worker/src/routes/notifications.ts` (new)
- `worker/src/index.ts` (routes)

**SPA**

- `src/lib/workerReadConfig.ts` — `USE_WORKER_NOTIFICATION_READS`, `useWorkerNotificationReads()`
- `src/lib/workerApi.ts` — notification client + pagination helper
- `src/lib/workerReadMappers.ts` — `workerNotificationToApp`
- `src/lib/workerReadAdapters.ts` — `fetchNotificationsFromWorker`
- `src/lib/database/repositories/supabaseRepositories.ts` — `getAll` branch only

**Tests / harness (local only)**

- `worker/scripts/test-api-local.mjs` — notification API checks
- `phase91-notification-harness.html`, `src/dev/phase91NotificationHarness.ts`
- `scripts/test-notification-read-harness.mjs`

**Docs / env**

- `.env.example`
- This file

## Tests performed (local)

| Step | Command | Result |
|------|---------|--------|
| D1 reset + seed | `cd worker && npm run db:reset:local` | PASS |
| Schema validation | `npm run db:validate` | PASS |
| D1 tests | `npm run db:test` | PASS (includes notification pagination SQL) |
| Worker API | `npm run test:api` (after Worker restart post-reset) | PASS |
| SPA build | `npm run build` | PASS |
| Notification harness — Worker mode | `node scripts/test-notification-read-harness.mjs` | PASS |
| Notification harness — failure mode | same script | PASS (no Supabase fallback) |
| Notification harness — Supabase mode | skipped (no `.env` Supabase; project 402) | SKIP — verify when Supabase available |

**Note:** Restart `wrangler dev --local --port 8787` after `db:reset:local`.

## Production safety

| Item | Status |
|------|--------|
| Production Supabase modified | **NO** |
| Remote D1 | **NO** |
| Worker deployed | **NO** |
| Notification writes | Still Supabase |
| Default SPA behavior | Unchanged (flag off) |
