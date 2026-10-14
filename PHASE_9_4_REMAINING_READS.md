# Phase 9.4 — Remaining safe PostgREST reads (Worker + local D1)

Final **read-only** migration batch for SPA repository paths. Writes, Auth, Storage, and Edge Functions are unchanged.

## Migrated reads

| Resource | Supabase path | Worker endpoint | Flag |
|----------|---------------|-----------------|------|
| Stage approvals queue | `sbApprovalRepo.getAll` | `GET /api/approvals?page&pageSize` | `VITE_USE_WORKER_REMAINING_READS` |
| Case task requests | `getAll`, `getForEmployee`, `getPendingForCase` | `GET /api/case-task-requests?employeeId&caseId&status` | same |
| Activity log (admin deferred) | `sbActivityRepo.getAll` (500 cap) | `GET /api/activity-log?page&pageSize` (500 cap) | same |
| Employee case scope | `getForEmployee`, `getFcfsPoolForEmployee`, `getCasesForEmployeeIncludingPool` | `GET /api/cases/for-employee/:id`, `GET /api/cases/fcfs-pool?stages=` + detail by id | `VITE_USE_WORKER_READS` **and** `VITE_USE_WORKER_REMAINING_READS` (`useWorkerCaseScopeReads()`) |

### Case filtering (performance)

**Before (Worker reads only, Phase 8):** `fetchAllCasesFromWorker()` — paginated list + N detail fetches for **every** case, then client filter for employee/pool.

**After (9.4 + Phase 8 flags on):** D1 filters assignee / stage JSON / snapshot and FCFS pool rows first; SPA fetches **only matching** case details (bounded caps: 300 assignee ids, 150 pool list).

Admin `sbCaseRepo.getAll()` still uses Phase 8 paginated list+detail when `VITE_USE_WORKER_READS` is on (unchanged in 9.4).

## Feature flags

| Variable | Default | Scope |
|----------|---------|--------|
| `VITE_USE_WORKER_REMAINING_READS` | `false` | Approvals, activity, case-task reads |
| `VITE_USE_WORKER_READS` | `false` | Required with remaining reads for case scope |

No silent Worker → Supabase fallback.

## SPA wiring

- `src/lib/workerReadConfig.ts` — `useWorkerRemainingReads()`, `useWorkerCaseScopeReads()`
- `src/lib/workerApi.ts` — queue + case-scope HTTP helpers
- `src/lib/workerReadMappers.ts` — approval / task / activity mappers
- `src/lib/workerReadAdapters.remaining.ts`
- `src/lib/database/repositories/supabaseRepositories.ts` — read branches only

## Authorization

Same dev stub as Phases 7–9.3.

## Tests (local D1)

```bash
cd worker && npm run db:reset:local && npm run db:validate && npm run db:test
npx wrangler dev --local --port 8787   # restart after reset
cd worker && npm run test:api
npm run build
node scripts/test-remaining-read-harness.mjs   # port 5173 (CORS)
```

Harness: `phase94-remaining-reads-harness.html` + `src/dev/phase94RemainingReadsHarness.ts`

## Known limitations

- Employee stage matching uses `stages LIKE '%uuid%'` (same practical approach as legacy snapshot fallback); extremely unlikely UUID collision.
- Admin bootstrap case load still list+detail via Phase 8 when only `VITE_USE_WORKER_READS` is enabled.
- `getNextCaseNumber` remains PostgREST (write-path helper).

## Remaining Supabase reads (not migrated — by design)

| Read | Reason |
|------|--------|
| `sbEmployeeRepo.getByAuthUserId`, `getByEmail` | Auth/session track; not Phase 9 |
| Supabase Auth API (`signIn`, session, OTP EFs) | Auth migration deferred |
| `sbCaseRepo.getNextCaseNumber` | Tied to case **create** flow |
| Doctor `app_settings` read inside doctor **write** paths | Write-side helper |
| `SupabaseStorageProvider.hydrate` | Legacy generic hydrate; bootstrap uses repos |
| Edge: `gallery-feed`, `dashboard-insights`, `location-hospital-search`, `location-bike-route` | Edge Function replacement out of scope |
| Storage signed URLs / uploads | Storage track |
| HR/TMS SPA repos | No SPA repository in this repo |
| All `insert` / `update` / `delete` / RPC writes | Write migration (Phase 10+) |

When **all** read flags are off, behavior matches original Supabase PostgREST paths.

## Production safety

| Item | Status |
|------|--------|
| Production Supabase modified | **NO** |
| Remote D1 | **NO** |
| Deployed | **NO** |

## Files changed

**Worker:** `src/services/caseScope.ts`, `src/services/workflowReads.ts`, `src/routes/workflowReads.ts`, `src/index.ts`, `scripts/test-api-local.mjs`, `scripts/seed-local.mjs`

**SPA:** `workerReadConfig.ts`, `workerApi.ts`, `workerReadMappers.ts`, `workerReadAdapters.ts`, `workerReadAdapters.remaining.ts`, `supabaseRepositories.ts`

**Tooling/docs:** `.env.example`, harness + `scripts/test-remaining-read-harness.mjs`, this file

---

## Final report (2026-10-14)

**PHASE 9.4 COMPLETE:** YES

| Check | Result |
|-------|--------|
| ALL SAFE READS MIGRATED | YES (repo/bootstrap reads; see table above for exclusions) |
| CASE FILTERING | PASS (scope endpoints; harness avoids full-table case pagination) |
| WORKER API | PASS |
| SPA WIRING | PASS |
| PAGINATION | PASS (queues + activity) |
| FILTERING | PASS (employee ids, FCFS pool, task filters) |
| NO SILENT FALLBACK | PASS |
| DUPLICATE REQUEST CHECK | PASS |
| LOCAL D1 TESTS | PASS |
| BUILD | PASS |

| Production safety | |
|-------------------|---|
| PRODUCTION SUPABASE MODIFIED | NO |
| REMOTE D1 TOUCHED | NO |
| DEPLOYMENT | NO |

**REMAINING SUPABASE READS:** See section above (auth, edge, storage, writes, `getNextCaseNumber`).
