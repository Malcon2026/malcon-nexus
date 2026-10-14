# Phase 11 — Production Cloudflare setup + staging bake-off

**Scope:** Infrastructure preparation and staging validation only.  
**Not in scope:** Production cutover, production SPA Worker flags, Supabase data/storage changes, Worker deploy (unless you explicitly run deploy commands below).

**Safety snapshot (this phase):**

| Check | Status |
|-------|--------|
| Production Supabase modified | NO |
| Supabase data deleted | NO |
| Supabase Storage deleted | NO |
| Production SPA deployed | NO |
| Worker deployed | NO (unless you run deploy) |
| Production Worker flags enabled | NO |
| Secrets committed | NO |

Supabase **402 egress** may block fresh live JWT/PostgREST parity tests until quota is restored.

---

## 1. Production config audit

### Cloudflare Worker (`worker/wrangler.toml`)

| Item | Current value | Action required |
|------|---------------|-----------------|
| Dev D1 | `malcon-nexus-dev`, `database_id = "local"` | None (keep local-only) |
| Staging Worker name | `malcon-nexus-api-staging` | Deploy when ready |
| Production Worker name | `malcon-nexus-api` | Deploy when ready |
| Staging D1 | `malcon-nexus-staging`, `REPLACE_WITH_STAGING_D1_ID` | Create DB → paste real UUID |
| Production D1 | `malcon-nexus-production`, `REPLACE_WITH_PRODUCTION_D1_ID` | Create DB → paste real UUID |
| Staging CORS | `https://app-staging.malconnexus.com` | Confirm staging SPA hostname |
| Production CORS | `https://app.malconnexus.com` | Matches Hostinger prod |
| Migrations | `drizzle/migrations` (0000–0003) | Apply with `db:migrate:*` |
| R2 bindings | Commented placeholders | Create buckets + uncomment |
| Worker route | Commented `api*.malconnexus.com` | Choose hostname + DNS |

### Worker secrets (Wrangler — never commit)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_JWT_SECRET` or `JWT_SECRET` | Verify Supabase `access_token` (HS256) |
| `SUPABASE_JWT_AUD` (optional var) | Default `authenticated` in code |
| Future: `TELEGRAM_BOT_TOKEN`, email, VAPID | Edge function parity (not required for D1 bake-off) |

Set per environment:

```bash
cd worker
npx wrangler secret put SUPABASE_JWT_SECRET --env staging
npx wrangler secret put SUPABASE_JWT_SECRET --env production
```

Source: Supabase Dashboard → Project → Settings → API → **JWT Secret** (not the anon key).

### SPA / Vite (Hostinger build — `scripts/deploy-hostinger-app.mjs`)

| Variable | Required today | Staging bake-off | Production cutover |
|----------|----------------|------------------|-------------------|
| `VITE_SUPABASE_URL` | Yes | Same Supabase project | Same |
| `VITE_SUPABASE_ANON_KEY` | Yes | Same | Same |
| `VITE_WORKER_API_URL` | Optional (defaults localhost) | **Staging Worker URL** | Production Worker URL |
| All `VITE_USE_WORKER_*` | Default unset/false | Enable **on staging only**, incrementally | **Stay OFF** until approved |
| `VITE_USE_WORKER_STORAGE` | OFF | OFF until R2 + public URL | OFF until approved |

Hostinger deploy loads `.env`, `.env.local`, `.env.production` (no secrets in git).

### GitHub

- `.github/workflows/deploy-vercel.yml` — legacy; **production is Hostinger**, not Vercel.
- No automated Cloudflare deploy workflow in repo — deploy Worker via local `wrangler` + CI you add later.

### Local reference

- `worker/.dev.vars.example` — JWT + optional `API_REQUIRE_AUTH=1`
- `MALCON_NEXUS_FINAL_MIGRATION_STATUS.md` — migration summary
- `PHASE_5_PRODUCTION_SAFETY.md` — what must never run on prod PG

---

## 2. Create Cloudflare D1 (staging + production)

**Do not** replace or delete local D1 (`database_id = "local"`).

### Prerequisites

- Cloudflare account with Workers + D1 enabled
- `npx wrangler login`

### Create databases (run manually — captures real IDs)

```bash
cd worker
npm run db:create:staging
npm run db:create:production
```

Wrangler prints a **database_id** (UUID) for each. Copy into `worker/wrangler.toml`:

- `[[env.staging.d1_databases]]` → `database_id = "<staging-uuid>"`
- `[[env.production.d1_databases]]` → `database_id = "<production-uuid>"`

**Do not invent IDs.** Commit only the wrangler.toml placeholders until you paste real UUIDs (or use a private ops doc).

### Verify binding (after migrate, empty DB)

```bash
cd worker
npx wrangler d1 execute malcon-nexus-staging --remote --env staging --command "SELECT 1 AS ok;"
npx wrangler d1 execute malcon-nexus-production --remote --env production --command "SELECT 1 AS ok;"
```

---

## 3. Production D1 schema (migrations only)

Use existing SQL migrations — **do not** hand-edit schema.

| Migration | Purpose |
|-----------|---------|
| `0000_famous_daimon_hellstrom.sql` | Core schema |
| `0001_hr_tms_production_schema.sql` | HR/TMS tables |
| `0002_attendance_approval_distance_m.sql` | Attendance column |
| `0003_production_column_alignment.sql` | Production alignment |

### Apply to remote D1 (you run when IDs are set)

```bash
cd worker
npm run db:migrate:staging
npm run db:migrate:production
```

### Post-migration verification (remote)

```bash
cd worker
npx wrangler d1 execute malcon-nexus-staging --remote --env staging --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
npx wrangler d1 execute malcon-nexus-staging --remote --env staging --command \
  "SELECT COUNT(*) AS migration_count FROM d1_migrations;"
npx wrangler d1 execute malcon-nexus-staging --remote --env staging --command "PRAGMA foreign_key_check;"
```

Repeat with `--env production` and production database name when ready.

**Critical tables to spot-check:** `employees`, `cases`, `notifications`, `activity_log`, `attendance_records`, `hospitals`, `doctors`, HR/TMS tables.

**Do not import application data** until export verification + explicit approval (Section 4).

---

## 4. Production data import plan

### Export source (validated Phase 6)

| Asset | Path |
|-------|------|
| JSONL export | `backups/production-data-2026-10-14-175253/` |
| Manifest | `manifest.json` (exported 2026-10-14, linked Postgres) |
| Row-count baseline | `backups/production-checks-2026-10-14/production-row-counts-full.txt` |

### Pre-import verification (run anytime — read-only)

```bash
node scripts/phase11-verify-export.mjs
```

This checks:

- Every `IMPORT_TABLE_ORDER` file line count vs manifest
- Spot-check vs Phase 4.7 row counts (`employees`, `cases`, `notifications`, `activity_log`, `attendance_records`)
- No dev fixture markers in `employees.jsonl`
- Reports count of rows with `auth_user_id` (required for Worker JWT mapping)

### What will be imported (30 tables, ~162k rows)

| Table | Rows (manifest) |
|-------|------------------:|
| activity_log | 78,719 |
| notifications | 73,228 |
| attendance_records | 5,565 |
| case_alert_escalations | 1,299 |
| cases | 555 |
| employee_food_selections | 350 |
| leave_requests | 308 |
| employee_daily_expenses | 249 |
| attendance_approval_requests | 169 |
| location_trips | 130 |
| doctors | 122 |
| hospitals | 93 |
| login_otps | 82 |
| malcon_tms_profiles | 50 |
| employees | 45 |
| field_team_attendance_approvals | 26 |
| surgical_kits | 12 |
| hr_onboarding_tracks | 13 |
| departments | 8 |
| hr_walk_in_applications | 8 |
| app_settings | 6 |
| hr_kyc_intake | 5 |
| hr_job_postings | 3 |
| push_subscriptions | 3 |
| approvals | 1 |
| case_task_requests | 1 |
| petrol_requests | 0 |
| hospital_trip_punches | 0 |
| malcon_tms_tasks | 0 |
| malcon_tms_activity | 0 |

**Import order:** `scripts/migration/table-order.mjs` (`IMPORT_TABLE_ORDER`).  
**Transforms:** `scripts/migration/transforms.mjs` with `--source postgres`.  
**Sensitive fields:** Export includes real `auth_user_id`, emails, phones, Telegram IDs, OTP rows — treat backups as **confidential**; never commit to git.

### Import command (existing tooling — **local D1 only**)

```bash
node scripts/import-d1-data.mjs \
  --dir backups/production-data-2026-10-14-175253 \
  --source postgres
```

This script **refuses `--remote`** by design (`PHASE_5_PRODUCTION_SAFETY.md`).

### Remote D1 import (staging first — **not automated in Phase 11**)

Approved sequence when you explicitly approve data load:

1. Complete Section 3 migrations on **staging** D1 only.
2. Re-run `phase11-verify-export.mjs` (and optionally fresh export if data drifted).
3. Port/import via an approved remote batch tool (not run in this phase) **or** load staging by restoring from a D1 export taken after a verified local import.

**Do not run destructive import on production D1** until staging bake-off passes.

---

## 5. Auth configuration

- Worker verifies Supabase JWT with `SUPABASE_JWT_SECRET` / `JWT_SECRET` (`worker/src/lib/jwt.ts`).
- App role and employee ID come **only** from D1 `employees` where `auth_user_id = jwt.sub`.
- Staging/production: `ENVIRONMENT` ≠ `development` → `/api/*` requires valid JWT + mapped employee (`worker/src/middleware/api-auth.ts`).
- `/health` — public, no secrets.
- `/health/db` — **404 outside development** (no employee counts in prod/staging).

**402 limitation:** Cannot re-verify live Supabase token issuance from this repo while egress is blocked; validate on staging after quota restore by logging in through the SPA and calling `/api/notifications/summary` with browser devtools Authorization header.

---

## 6. R2 preparation

| Logical bucket | Worker binding | Suggested object key pattern |
|----------------|----------------|------------------------------|
| stage-photos | `STAGE_PHOTOS` | `{caseId}/{stage}/{timestamp}-{id}-full.jpg` + `-thumb.jpg` |
| attendance-selfies | `ATTENDANCE_SELFIES` | `{approval\|record}/{id}/{timestamp}.jpg` |
| hr-kyc-uploads | `HR_KYC_UPLOADS` | `{intakeId}/{filename}` |

**Worker routes (implemented):**

- `GET /api/storage/status`
- `POST /api/storage/:bucket/upload` (multipart: `key`, `file`, `contentType`, `caseId` for stage-photos)
- `DELETE /api/storage/:bucket/objects` JSON `{ keys: [] }`

**Manual Cloudflare actions:**

1. Create three R2 buckets per environment (names in `wrangler.toml` comments).
2. Uncomment `[[env.*.r2_buckets]]` blocks and set exact bucket names.
3. Configure public access **or** `R2_PUBLIC_BASE_URL` / signed URL strategy (SPA needs thumb URLs).
4. Do **not** delete or bulk-copy Supabase Storage in this phase.

---

## 7. Worker deployment preparation

### Pre-deploy checklist

- [ ] Staging/production D1 IDs in `wrangler.toml`
- [ ] Migrations applied remotely
- [ ] `SUPABASE_JWT_SECRET` set for that env
- [ ] CORS origin matches SPA hostname
- [ ] Optional: custom domain route + DNS
- [ ] R2 bindings (if testing storage)

### Deploy commands (**do not run until ready**)

```bash
cd worker
npm run deploy:staging
npm run deploy:production
```

### Post-deploy smoke (no secrets in output)

```bash
curl -sS "https://<worker-host>/health"
curl -sS -o /dev/null -w "%{http_code}" "https://<worker-host>/health/db"   # expect 404 staging/prod
curl -sS -o /dev/null -w "%{http_code}" "https://<worker-host>/api/employees"  # expect 401 without JWT
```

---

## 8. Staging bake-off

### Architecture under test

```text
Browser (staging SPA) → Supabase Auth (login)
                      → Worker (Bearer JWT) → Staging D1
Supabase Postgres/Storage: unchanged fallback when flags OFF
```

### Automated API suite (against deployed staging Worker)

```bash
WORKER_BASE_URL=https://<staging-worker-host> npm run phase11:bakeoff
```

Runs: `test:api`, `test:writes`, `test:writes:medium`, `test:writes:cases`, `test:auth`, `test:storage`.

**Note:** `test:auth` full JWT tests need Worker `SUPABASE_JWT_SECRET` aligned with Supabase project; FCFS dual-claim is covered in `test:writes:cases`.

### Staging SPA env (example — flags ON **staging only**)

```env
VITE_WORKER_API_URL=https://<staging-worker-host>
VITE_USE_WORKER_READS=true
# … enable one write/read domain at a time
```

### Manual checklist

| Area | Tests |
|------|--------|
| Auth | Login, JWT on Worker calls, admin vs employee, 401/403 |
| Reads | Employees, cases, notifications, attendance, reference, dashboards, approvals, queues |
| Writes | CRUD paths listed in Phase 11 prompt (all Worker write flags on staging) |
| FCFS claim | Two employees, one case → **200 + 409** |

**Status:** BLOCKED until staging Worker + staging D1 (+ data) exist and staging SPA is deployed with flags.

---

## 9. Feature flag matrix

Production column **must stay OFF** until cutover approval.

| Flag | Local | Staging | Production | Readiness |
|------|-------|---------|------------|-----------|
| `VITE_WORKER_API_URL` | localhost:8787 | staging Worker URL | prod Worker URL | READY (set URL only) |
| `VITE_USE_WORKER_READS` | tested | enable for bake-off | **OFF** | REQUIRES AUTH + D1 data |
| `VITE_USE_WORKER_NOTIFICATION_READS` | tested | bake-off | **OFF** | REQUIRES AUTH + D1 |
| `VITE_USE_WORKER_REFERENCE_READS` | tested | bake-off | **OFF** | REQUIRES AUTH + D1 |
| `VITE_USE_WORKER_OPERATIONS_READS` | tested | bake-off | **OFF** | REQUIRES AUTH + D1 |
| `VITE_USE_WORKER_REMAINING_READS` | tested | bake-off | **OFF** | REQUIRES AUTH + D1 |
| `VITE_USE_WORKER_WRITES_ACTIVITY` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_NOTIFICATIONS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_SETTINGS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_KITS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_EXPENSES` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_APPROVALS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_EMPLOYEES` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_HOSPITALS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_DOCTORS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_ATTENDANCE` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_LEAVE` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_FOOD` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_PETROL` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_TRIPS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_CASE_TASKS` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_CASES` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_WRITES_CASE_CLAIM` | tested | bake-off | **OFF** | REQUIRES AUTH |
| `VITE_USE_WORKER_STORAGE` | 501 without R2 | bake-off | **OFF** | REQUIRES R2 + public URL |

---

## 10. Rollback

If Worker or D1 path misbehaves on **staging** (or after future cutover):

1. Set all `VITE_USE_WORKER_*` and `VITE_USE_WORKER_STORAGE` to **false** (or remove from Hostinger env).
2. Redeploy SPA: `npm run deploy:hostinger` (Supabase paths remain in code).
3. Optionally disable Worker route in Cloudflare; **do not delete** D1 or R2 buckets.
4. **Do not** modify or delete Supabase data or Storage objects.

Supabase remains the rollback system of record until explicit cutover sign-off.

---

## 11. Production cutover prerequisites (not executed here)

- [ ] Staging bake-off PASS (auth, reads, writes, FCFS)
- [ ] Supabase egress restored for spot checks
- [ ] Production D1 migrated + data loaded + row counts verified
- [ ] Worker production deploy + secrets + CORS
- [ ] R2 + storage migration plan (optional before cutover)
- [ ] Runbook owner + maintenance window
- [ ] Incremental flag rollout plan on production SPA

---

## 12. Commands reference

```bash
# Export verification
node scripts/phase11-verify-export.mjs

# Local import rehearsal (local D1 only)
cd worker && npm run db:reset:local   # destroys LOCAL only
node scripts/import-d1-data.mjs --dir backups/production-data-2026-10-14-175253 --source postgres
cd worker && npm run db:validate && npm run test:api

# Cloudflare (manual)
cd worker && npm run db:create:staging
cd worker && npm run db:migrate:staging
cd worker && npm run deploy:staging

# Staging bake-off (after deploy)
WORKER_BASE_URL=https://... npm run phase11:bakeoff
```
