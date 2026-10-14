# Phase 7 — Test report

**Date:** 2026-10-14  
**Environment:** local D1 + `wrangler dev --local --port 8787`  
**Production Supabase / remote D1 / SPA:** not modified

## D1 baseline (pre-API)

| Command | Result |
|---------|--------|
| `npm run db:reset:local` | PASS (migrations + seed) |
| `npm run db:validate` | PASS |
| `npm run db:test` | PASS |

## Worker API (`npm run test:api`)

| # | Check | Result |
|---|--------|--------|
| 1 | `GET /health` | PASS |
| 2 | `GET /health/db` (D1 binding + employee count) | PASS |
| 3 | `GET /api/employees` (array, no `auth_user_id`) | PASS |
| 4 | `GET /api/employees/:id` valid id | PASS |
| 5 | `GET /api/cases` paginated list | PASS |
| 6 | `GET /api/cases/:id` detail + `stages` array | PASS |
| 7 | Pagination `page=1&pageSize=5` | PASS |
| 8 | Not found employee UUID | PASS (404) |
| 9 | Invalid employee id | PASS (400) |
| 10 | Invalid pagination (`page=0`, `pageSize=500`) | PASS (400) |
| 11 | Case list excludes `stages` blob | PASS |
| 12 | Auth boundary (dev default: anonymous read OK) | PASS (documented) |

**Auth enforcement test (manual):** set `API_REQUIRE_AUTH=1` in Wrangler vars → `/api/*` returns **401** without `Authorization` (via `enforceApiAuth`).

## Query safety review

- Explicit Drizzle column maps in `services/employees.ts`, `services/cases.ts` — **no SELECT \***
- Path IDs validated as UUID-shaped before DB access
- No unbounded notification/activity_log endpoints added

## Known gaps (expected)

- JWT verification stubbed (`resolveAuthFromRequest` returns null)
- `canReadCase` not yet wired to case routes (open read in dev; tighten in Phase 9)
- Write operations not exposed
