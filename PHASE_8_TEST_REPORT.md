# Phase 8 — test report (local)

## Final validation gate (Supabase restored?) — 2026-10-14

**Pre-flight check (before browser validator):** `signInWithPassword` + `employees` sample query against linked project `iaxkbiejmwnstckiggwg.supabase.co`.

| Check | Result |
|-------|--------|
| Supabase auth | **STILL BLOCKED** — `exceed_egress_quota` / service restricted (402) |
| Full `node scripts/phase8-spa-browser-validation.mjs` | **NOT RUN** (stopped per Phase 8 instructions) |
| Authenticated SPA bootstrap | **NOT VERIFIED** (requires restored Supabase) |

No application code, Worker API, or production data was changed on this gate.

---

**Last full browser run (partial — Supabase blocked):** 2026-10-14T16:18:44Z  
**Framework:** Puppeteer (system Chrome) + `phase8-harness.html` (real Vite bundle, same `sbEmployeeRepo` / `sbCaseRepo` as SPA)  
**Worker port:** 8787 (reused healthy `workerd`)  
**SPA port:** 5173 (fresh Vite per mode; `localhost` not `127.0.0.1` — Vite binds IPv6 localhost)

**Command:** `node scripts/phase8-spa-browser-validation.mjs`  
**Evidence JSON:** `backups/phase8-browser-validation-2026-10-14.json`

---

## Production Supabase blocker (environment)

Auth and PostgREST return **402 / egress quota restricted** for project `iaxkbiejmwnstckiggwg.supabase.co`:

> Service for this project is restricted due to the following violations: exceed_egress_quota.

This is **not** a Phase 8 migration defect. Supabase-mode **data** reads and **logged-in bootstrap** could not be validated against live Supabase until the project is restored.

---

## Automated (non-browser)

| Step | Command | Result |
|------|---------|--------|
| Local D1 reset + seed | `cd worker && npm run db:reset:local` | PASS (prior run) |
| Schema validation | `npm run db:validate` | PASS (prior run) |
| D1 query tests | `npm run db:test` | PASS (prior run) |
| Worker API | `npm run test:api` @ `:8787` | PASS (prior run) |
| SPA build | `npm run build` | PASS (prior run) |

---

## SUPABASE MODE (`VITE_USE_WORKER_READS=false`)

Fresh Vite process; SPA login shell + harness module reads.

| Check | Result | Notes |
|-------|--------|-------|
| App startup | **PASS** | Login shell (`.nexus-login-page`) loads |
| Employees | **FAIL** | Harness: Supabase project restricted |
| Cases | **FAIL** | Same |
| Employee detail | **FAIL** | Blocked |
| Case detail | **FAIL** | Blocked |
| Bootstrap | **NOT VERIFIED** | Admin login returns 402; no session |
| Network routing | **FAIL** | No successful `rest/v1/employees` or `cases` (API blocked) |
| Console | **FAIL** | Expected 402 on auth token request |

Login attempt used `testadmin@gmail.com` (documented in `supabase/bootstrap-test-admin.sql`); override via `PHASE8_ADMIN_EMAIL` / `PHASE8_ADMIN_PASSWORD`.

---

## WORKER MODE (`VITE_USE_WORKER_READS=true`, `VITE_WORKER_API_URL=http://127.0.0.1:8787`)

Fresh Vite process; harness only (login still blocked by Supabase auth).

| Check | Result | Notes |
|-------|--------|-------|
| App startup | **PASS** | Login shell loads |
| Employees | **PASS** | 5 employees via Worker |
| Cases | **PASS** | 10 cases via Worker |
| Employee detail | **PASS** | `GET /api/employees/:id` |
| Case detail | **PASS** | `GET /api/cases/:id` |
| Bootstrap | **NOT VERIFIED** | Auth blocked; harness covers repo reads |
| Network routing | **PASS** | 2 employee + 12 case Worker calls; **0** Supabase `rest/v1/employees` / `cases` |
| Duplicate request check | **PASS** | No same-read Supabase + Worker |
| Console | **PASS** | (harness page) |

---

## WORKER FAILURE MODE (invalid Worker URL)

`VITE_WORKER_API_URL=http://127.0.0.1:59999`, flag on.

| Check | Result |
|-------|--------|
| No silent Supabase fallback | **PASS** — harness error `Failed to fetch`; **0** Supabase employee/case REST reads |

---

## SPA UI navigation (employees/cases pages)

**NOT VERIFIED** — requires successful Supabase auth. Harness validates the **same repository read path** the SPA uses after login.

---

## Re-run

```bash
# Worker on 8787 (reuse or: cd worker && npx wrangler dev --local --port 8787)
node scripts/phase8-spa-browser-validation.mjs
```

Optional: `.env.local` with `VITE_*` and `PHASE8_ADMIN_*` when Supabase is healthy for full Supabase-mode routing checks.

When Supabase is restored, re-run the gate check, then:

```bash
node scripts/phase8-spa-browser-validation.mjs
```

**Required for Phase 8 sign-off:** authenticated SPA login, bootstrap completion, employees/cases UI + network checks in **both** modes (not harness-only). Extend the existing validator in-place if bootstrap/UI steps are still missing when Supabase is back.

---

## Production safety (this run)

| Item | Value |
|------|--------|
| Production Supabase modified | **NO** (read/auth attempts only; project already restricted) |
| Remote D1 touched | **NO** |
| Production deployment | **NO** |
