# Phase 9.2 — Reference-data reads (Worker + local D1)

## Resources migrated (reads only)

| Resource | Supabase repo | `getAll` callers | Pagination decision |
|----------|---------------|------------------|---------------------|
| Hospitals | `sbHospitalRepo.getAll` | Bootstrap (admin, employee deferred, store_manager paths) | **Paginated** API; SPA loads up to **2000** rows via pages (100/page) |
| Doctors | `sbDoctorRepo.getAll` | Bootstrap admin / store_manager | **Paginated**; includes `doctor_master_list` merge in Worker |
| Departments | `sbDepartmentRepo.getAll` | Bootstrap admin, employee deferred | **Single response** (≤200 rows; full catalog required for UI) |
| Surgical kits | `sbKitRepo.getAll` | Bootstrap admin deferred | **Single response** (≤500 rows) |
| App settings | `sbSettingsRepo.getAll` | `useStore` notice/incentive loads | **Single response** (`key`, `value` only; ≤200 keys) |

**Not in Phase 9.2:** employees (Phase 8 `VITE_USE_WORKER_READS`), notifications (Phase 9.1), approvals, attendance, etc.

**Writes unchanged:** all `create` / `update` / `delete` / `set` on these repos remain Supabase.

## Worker endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/hospitals?page&pageSize` | `{ items, pagination }` |
| GET | `/api/doctors?page&pageSize` | `{ items, pagination }` + `master_list_code` |
| GET | `/api/departments` | `[{ id, name, description, color }]` |
| GET | `/api/surgical-kits` | `[{ id, name, type, serial_number, status, last_used_date }]` |
| GET | `/api/settings` | `Record<string, string>` |

Explicit column selection in `worker/src/services/referenceData.ts`. No `SELECT *`.

## Feature flag

| Variable | Default |
|----------|---------|
| `VITE_USE_WORKER_REFERENCE_READS` | `false` |

When **true:** only Worker for the five `getAll` paths above.  
When **false:** Supabase PostgREST (unchanged).  
**No** silent Worker → Supabase fallback.

Independent of `VITE_USE_WORKER_READS` and `VITE_USE_WORKER_NOTIFICATION_READS`.

## SPA wiring

- `src/lib/workerReadConfig.ts` — `useWorkerReferenceReads()`
- `src/lib/workerApi.ts` — HTTP + paginated hospital/doctor helpers
- `src/lib/workerReadMappers.ts` — `workerHospitalToApp`, `workerDoctorToApp`, etc.
- `src/lib/workerReadAdapters.ts` — fetch*FromWorker
- `src/lib/database/repositories/supabaseRepositories.ts` — `getAll` branches only

## Authorization

Same dev stub as Phase 7–9.1 (`buildAuthContext` / `enforceApiAuth`).

## Tests (local)

```bash
cd worker && npm run db:reset:local && npm run db:validate && npm run db:test
# restart wrangler dev --local --port 8787 after reset
cd worker && npm run test:api
npm run build
node scripts/test-reference-read-harness.mjs
```

Harness: `phase92-reference-harness.html` + `src/dev/phase92ReferenceHarness.ts`

Supabase-mode harness: **SKIP** when no valid `VITE_SUPABASE_*` (production 402).

## Production safety

| Item | Status |
|------|--------|
| Production Supabase modified | **NO** |
| Remote D1 | **NO** |
| Deployed | **NO** |

## Files changed

**Worker:** `src/services/referenceData.ts`, `src/routes/referenceData.ts`, `src/index.ts`, `scripts/test-api-local.mjs`

**SPA:** `workerReadConfig.ts`, `workerApi.ts`, `workerReadMappers.ts`, `workerReadAdapters.ts`, `supabaseRepositories.ts`

**Tooling/docs:** `.env.example`, harness + `scripts/test-reference-read-harness.mjs`, this file

---

## Final report (2026-10-14)

**PHASE 9.2 COMPLETE:** YES

| Check | Result |
|-------|--------|
| REFERENCE DATA READS MIGRATED | YES |
| WORKER API | PASS (`npm run test:api`) |
| SPA WIRING | PASS (Worker harness) |
| PAGINATION | PASS (hospitals/doctors paginated; departments/kits/settings bounded single fetch) |
| SUPABASE FALLBACK MODE | NOT VERIFIED (402 / no env; harness SKIP) |
| NO SILENT FALLBACK | PASS (failure mode: Worker error, zero Supabase reads) |
| DUPLICATE REQUEST CHECK | PASS (`duplicateRead: false`) |
| LOCAL D1 TESTS | PASS (`db:reset:local`, `db:validate`, `db:test` — prior session + API after Worker restart) |
| BUILD | PASS (`npm run build`) |

| Production safety | |
|-------------------|---|
| PRODUCTION SUPABASE MODIFIED | NO |
| REMOTE D1 TOUCHED | NO |
| DEPLOYMENT | NO |
