# Phase 8 — SPA read migration (local Worker)

## Feature flag (default Supabase)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_USE_WORKER_READS` | `false` | When `true`, employee/case **reads** use Worker API |
| `VITE_WORKER_API_URL` | `http://127.0.0.1:8787` | Local Worker base URL |

No silent fallback: if the flag is `true` and the Worker fails, errors propagate (no hidden Supabase read).

## Migrated reads (flag on)

| Operation | Worker endpoint |
|-----------|-----------------|
| List employees | `GET /api/employees` |
| Employee by id | `GET /api/employees/:id` |
| List cases (bootstrap) | `GET /api/cases?page=&pageSize=` then `GET /api/cases/:id` per row |
| Case by id | `GET /api/cases/:id` |
| Employee cases + FCFS pool | Single Worker case load + in-memory filter (same rules as Supabase repo) |

## SPA files touched

- `src/lib/workerReadConfig.ts` — flag + URL
- `src/lib/workerApi.ts` — HTTP client
- `src/lib/workerReadMappers.ts` — Worker JSON → PG-shaped rows
- `src/lib/workerReadAdapters.ts` — Employee / ImplantCase adapters
- `src/lib/database/repositories/supabaseRepositories.ts` — read branches on `sbEmployeeRepo` / `sbCaseRepo` only

**Not changed:** `bootstrap.ts` structure, auth, writes, UI components, Supabase client.

## Data mapping

- Employees: Worker snake_case → `Employee` (no `auth_user_id` / `telegram_chat_id` from API).
- Cases: Worker detail → `caseRowToImplantCase` via minor-unit → decimal for invoice/collected.
- List endpoints are not used directly in UI yet; bootstrap uses paginated list + detail fetch.

## Performance (Worker mode)

- Case bootstrap: multiple paginated list requests + concurrent detail fetches (not one PostgREST `select *`).
- Does **not** download notifications/activity_log via Worker.
- See `PHASE_7_API_PERFORMANCE.md`.

## Local test

```bash
# Terminal 1 — D1 + seed or production import
cd worker && npm run db:reset:local   # or keep Phase 6 import DB

# Terminal 2 — Worker
cd worker && npx wrangler dev --local --port 8787

# Terminal 3 — SPA
# .env.local:
#   VITE_USE_WORKER_READS=true
#   VITE_WORKER_API_URL=http://127.0.0.1:8787
npm run dev
```

Network: with flag **false**, employee/case reads hit Supabase. With flag **true**, they hit `127.0.0.1:8787` only for those reads.

## Known limitations

- Auth still Supabase-only (`getByAuthUserId` / `getByEmail`).
- Employee case visibility uses client-side filtering on full case set (no Worker RLS yet).
- Admin case bootstrap may issue many detail requests (local dev acceptable; optimize in Phase 9+).
- Attendance via Worker: `GET /api/employees/:id/attendance` exists but SPA not wired yet.

## Remaining Supabase reads

Everything except `sbEmployeeRepo.getAll/getById` and `sbCaseRepo` read methods listed above.

## Test evidence

See `PHASE_8_TEST_REPORT.md`. Automated worker + build checks passed; browser network verification for both flag modes is a manual step on the developer machine.
