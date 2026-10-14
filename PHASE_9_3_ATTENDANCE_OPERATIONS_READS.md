# Phase 9.3 — Attendance & operations reads (Worker + local D1)

## Migrated read operations (reads only)

| Resource | Supabase repo methods | Bootstrap / callers | Worker endpoint | Pagination / filters |
|----------|----------------------|---------------------|-----------------|----------------------|
| Attendance (admin) | `sbAttendanceRepo.getAll` | Admin / store_manager bootstrap | `GET /api/attendance-records` | Paginated (100/page); SPA cap **5000** rows |
| Attendance (employee) | `getRecentForEmployee(id, since)` | Employee essential + deferred (30 / 150 day lookback) | `GET /api/employees/:id/attendance?since&until` | Server `since`/`until`; paginated until cap |
| Attendance approvals | `getAll`, `getForEmployee` | Admin, employee, store_manager | `GET /api/attendance-approval-requests?employeeId` | Paginated; cap **2000** |
| Field team attendance | `getAll`, `getForDate` | Admin bootstrap | `GET /api/field-team-attendance?dateKey` or paginated | `dateKey` → single bounded fetch |
| Leave | `getAll`, `getForEmployee` | All roles bootstrap | `GET /api/leave-requests?employeeId` | Paginated; cap **2000** |
| Petrol | `getAll`, `getForEmployee` | Admin, employee, petrol role | `GET /api/petrol-requests?employeeId` | Paginated; cap **2000** |
| Location trips | `getAll`, `getForEmployee` | Admin + employee bootstrap | `GET /api/location-trips?employeeId` | Paginated; cap **2000** |
| Food selections | `getAll`, `getForEmployee`, `getForDateRange` | Admin (date window), employee | `GET /api/food-selections?employeeId&fromDate&toDate` | Server date range + pagination |
| Daily expenses | `sbExpenseRepo.getAll` | Admin expenses screen (`useStore`) | `GET /api/daily-expenses` | Paginated; cap **2000** |

**Not in Phase 9.3:** `sbApprovalRepo`, `sbCaseTaskRequestRepo`, `sbActivityRepo` (Phase 9.4+), auth reads, writes, Storage, Edge Functions.

**Writes unchanged** on all repos above.

## Feature flag

| Variable | Default |
|----------|---------|
| `VITE_USE_WORKER_OPERATIONS_READS` | `false` |

Independent of Phase 8 / 9.1 / 9.2 flags. **No** silent Worker → Supabase fallback when on.

## SPA wiring

- `src/lib/workerReadConfig.ts` — `useWorkerOperationsReads()`
- `src/lib/workerApi.ts` — paginated operations client + caps
- `src/lib/workerReadMappers.ts` — row → app types
- `src/lib/workerReadAdapters.operations.ts` — fetch helpers
- `src/lib/database/repositories/supabaseRepositories.ts` — read branches only

## Authorization

Same dev stub as Phases 7–9.2 (`buildAuthContext` / `enforceApiAuth`).

## Tests (local D1 only)

```bash
cd worker && npm run db:reset:local && npm run db:validate && npm run db:test
# restart: npx wrangler dev --local --port 8787
cd worker && npm run test:api
npm run build
node scripts/test-operations-read-harness.mjs
```

Harness: `phase93-operations-harness.html` + `src/dev/phase93OperationsHarness.ts`

**Local Wrangler note:** If a restart exits with code 1 but a replacement `wrangler dev` on 8787 serves tests successfully, treat as tooling-only (no app change).

Supabase-mode harness: **NOT VERIFIED** when project is 402 / no live env.

## Production safety

| Item | Status |
|------|--------|
| Production Supabase modified | **NO** |
| Remote D1 | **NO** |
| Deployed | **NO** |

## Files changed

**Worker:** `src/services/attendanceRecords.ts`, `src/services/operationsData.ts`, `src/routes/operationsData.ts`, `src/services/employees.ts`, `src/routes/employees.ts`, `src/index.ts`, `scripts/test-api-local.mjs`, `scripts/seed-local.mjs`

**SPA:** `workerReadConfig.ts`, `workerApi.ts`, `workerReadMappers.ts`, `workerReadAdapters.ts`, `workerReadAdapters.operations.ts`, `supabaseRepositories.ts`

**Tooling/docs:** `.env.example`, harness + `scripts/test-operations-read-harness.mjs`, this file

---

## Final report (2026-10-14)

**PHASE 9.3 COMPLETE:** YES

| Check | Result |
|-------|--------|
| ATTENDANCE/OPERATIONS READS MIGRATED | YES |
| WORKER API | PASS (`npm run test:api`) |
| FILTERING | PASS (`since`, `dateKey`, `fromDate`/`toDate`, `employeeId` in API tests) |
| PAGINATION | PASS (100/page cap; SPA bootstrap caps documented above) |
| DATE RANGE | PASS (employee attendance `since`; food `fromDate`/`toDate`) |
| SPA WIRING | PASS (Worker harness on port 5173 — matches `API_CORS_ORIGIN`) |
| SUPABASE FALLBACK MODE | NOT VERIFIED (402 / harness SKIP) |
| NO SILENT FALLBACK | PASS (failure mode: error, zero Supabase reads) |
| DUPLICATE REQUEST CHECK | PASS (`duplicateRead: false`) |
| LOCAL D1 TESTS | PASS (`db:reset:local`, `db:validate`, `db:test`) |
| BUILD | PASS (`npm run build`) |

| Production safety | |
|-------------------|---|
| PRODUCTION SUPABASE MODIFIED | NO |
| REMOTE D1 TOUCHED | NO |
| DEPLOYMENT | NO |
