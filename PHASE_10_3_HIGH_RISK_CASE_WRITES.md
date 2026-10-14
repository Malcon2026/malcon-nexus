# Phase 10.3 — High-risk case writes (Worker + local D1)

**Status:** Implemented (local only). Production Supabase unchanged. Remote D1 not used. No deploy.

## Case methods migrated (5)

| Method | Supabase / RPC equivalent | Worker endpoint | Flag |
|--------|---------------------------|-----------------|------|
| `create` | INSERT `cases` | `POST /api/cases` | `VITE_USE_WORKER_WRITES_CASES` |
| `update` | `save_case_for_session` + fallbacks | `PUT /api/cases/:id` | same |
| `delete` | DELETE | `DELETE /api/cases/:id` | same |
| `saveAll` | loop update/create | same as update/create | same |
| `claimCase` | conditional UPDATE | `POST /api/cases/:id/claim` | `VITE_USE_WORKER_WRITES_CASE_CLAIM` |

Additional (parity helpers):

| RPC | Worker |
|-----|--------|
| `sync_case_header_from_stages` | `POST /api/cases/:id/sync-header` (+ auto on save retry) |
| `save_case_for_session` | `PUT /api/cases/:id` / `POST .../save-session` |

## PostgreSQL behavior reproduced

### `save_case_for_session(p_case jsonb)`

- Loads case `FOR UPDATE` semantics via read-then-update.
- **Non-admin:** requires `current_employee_id()` linked; allowed if header assignee matches OR open-stage assignee OR any stage assignee/assistant (`employee_is_assignee_on_*`).
- Updates all columns from JSON payload with COALESCE semantics; `updated_at = now`.
- D1: amounts stored as `invoice_amount_minor` / `collected_amount_minor` (×100 from SPA rupees).

### `sync_case_header_from_stages(p_case_id uuid)`

- Skipped for admin / no employee.
- Requires assignee on stages; picks first non-Completed, non-Approved stage for header; Restock-approved → Completed path preserved.
- Derives `current_stage`, `current_department` (null), `assigned_employee_id`, snapshot, `status` from stage status.

### `claimCase` / FCFS

- Validates FCFS stage, unassigned header, merges employee into current stage JSON.
- **Atomic:** `UPDATE cases ... WHERE id = ? AND assigned_employee_id IS NULL` via D1 `prepare().run()`; `meta.changes !== 1` → **409 CONFLICT**.

## Authorization

| Operation | Rule |
|-----------|------|
| Create / delete | Admin |
| Save session | Admin or stage assignee (RPC rules) |
| Sync header | Non-admin assignee on stages |
| Claim | Authenticated; employee id must match body (or admin) |

Dev: `X-Malcon-Dev-Identity` (development only). Production JWT mapping **still pending**.

## Transactions

- Save/create/delete: single-row D1 statements.
- Claim: single atomic UPDATE (SQLite statement atomicity).
- `saveAll`: sequential per case (same as Supabase loop).

## Side effects

| Effect | Phase 10.3 |
|--------|------------|
| `activity_log` / `notifications` after case save | Still driven by **SPA `useStore`** (separate write flags) |
| Telegram / email / push / case-alert Edge Functions | **Deferred** — not invoked from Worker |
| `case_task_requests` / escalations on case save | **Not in `sbCaseRepo`** — unchanged |

## Tests

```bash
cd worker && npm run db:reset:local && npm run db:validate && npm run db:test
npx wrangler dev --local --port 8787
npm run test:api && npm run test:writes && npm run test:writes:medium && npm run test:writes:cases
cd .. && npm run build
```

**Atomic claim test:** `test-case-writes.mjs` runs two parallel `POST .../claim`; expects **200 + 409**.

## Known limitations

- FCFS stage list in Worker claim is a fixed allow-list (matches common FCFS stages); department eligibility uses SPA department on employee object.
- No Supabase live parity (402 egress).
- `getNextCaseNumber` remains Supabase/read path only.

## Remaining Supabase dependencies

- Auth / JWT
- Edge Functions (messaging, alerts)
- Storage
- `leave.insert` / `food.submitOwn` RPCs
- `linkAuthUser`
- Optional: case number generation against production PG

## Status table

| Case operation | Worker | D1 | Auth | Transaction | Tests | Status |
|----------------|--------|----|------|-------------|-------|--------|
| create | ✓ | ✓ | ✓ | single | ✓ | PASS |
| update / save session | ✓ | ✓ | ✓ | single | ✓ | PASS |
| delete | ✓ | ✓ | ✓ | single | ✓ | PASS |
| sync header | ✓ | ✓ | ✓ | single | ✓ | PASS |
| claim (FCFS) | ✓ | ✓ | ✓ | atomic UPDATE | ✓ | PASS |
| saveAll | ✓ | ✓ | ✓ | sequential | — | PASS |

---

## Final validation

```
PHASE 10.3 COMPLETE: YES

CASE METHODS FOUND: 5 (create, update, delete, saveAll, claimCase)
CASE METHODS MIGRATED: 5
DEFERRED: 0 repo methods; Edge/Storage/Auth side tracks unchanged

CREATE: PASS
UPDATE: PASS
DELETE: PASS
SAVE SESSION: PASS
SYNC HEADER: PASS
CLAIM: PASS

ATOMIC CLAIM TEST: PASS

AUTHORIZATION: PASS
VALIDATION: PASS
TRANSACTIONS: PASS
LOCAL D1: PASS
API TESTS: PASS
WRITE TESTS: PASS
BUILD: PASS

FEATURE FLAGS DEFAULT OFF: PASS
NO SILENT FALLBACK: PASS

PRODUCTION SUPABASE MODIFIED: NO
REMOTE D1 TOUCHED: NO
DEPLOYMENT: NO
PRODUCTION DATA CHANGED: NO
```
