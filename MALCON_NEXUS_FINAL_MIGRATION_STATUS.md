# Malcon Nexus — Final Migration Status

**Last updated:** 2026-10-14 (Phase 11 infrastructure prep)  
**Production Supabase modified:** NO  
**Remote D1 touched:** NO  
**Production deploy performed:** NO  
**Phase 11 doc:** [`PHASE_11_PRODUCTION_SETUP.md`](PHASE_11_PRODUCTION_SETUP.md)

Supabase production currently returns **402 egress quota exceeded** — live Supabase parity was **not** re-verified in this pass. Local D1 + local Worker validation only.

---

## 1. Completed migration

| Area | Status |
|------|--------|
| Phase 1–9 (audit, D1, reads) | Done (do not redo) |
| Phase 10.1 low-risk writes (9/9) | Done |
| Phase 10.2 medium-risk writes (29/29 + deferred RPCs now on Worker) | Done |
| Phase 10.3 high-risk case writes (5/5) + atomic FCFS claim | Done |
| Production JWT → Worker auth (HS256 Supabase secret) | Implemented locally |
| Employee mapping `auth_user_id` → D1 `employees` | Implemented |
| Remaining writes: `leave.insert` (submit-own), `food.submitOwn`, `linkAuthUser` | Worker + SPA flags |
| R2 storage abstraction (SPA → Worker, no direct Supabase when flagged) | Implemented; R2 not bound locally |
| Edge function audit | Classified below |
| Feature flag matrix | Section 8 |

---

## 2. Remaining Supabase dependencies

- **Auth:** Supabase Auth remains identity provider (login, OTP edge functions, session/JWT).
- **Postgres + RLS:** Fallback for all paths while `VITE_USE_WORKER_*` flags are OFF.
- **Storage:** `stage-photos`, `attendance-selfies`, `hr-kyc-uploads` until `VITE_USE_WORKER_STORAGE=true` and R2 + public URLs configured.
- **Edge Functions:** Messaging (Telegram, push, email), OTP login, some uploads, TV/gallery feeds — see Section 7.
- **Realtime:** Any Supabase realtime channels still used by the SPA (unchanged).

---

## 3. Authentication architecture

```
Supabase login/session (SPA)
        ↓
access_token (JWT, HS256)
        ↓
Authorization: Bearer … on Worker fetch (workerApi / workerWrite*)
        ↓
Worker verifySupabaseAccessToken (SUPABASE_JWT_SECRET or JWT_SECRET)
        ↓
D1 SELECT employees WHERE auth_user_id = JWT.sub
        ↓
ctx.employeeId + ctx.role from D1 only (never from body)
        ↓
middleware/authorization.ts + writeAuth.ts + route checks
```

- **`X-Malcon-Dev-Identity`:** `ENVIRONMENT=development` only; ignored in staging/production.
- **Invalid/expired JWT:** 401 on `/api/*` when bearer present.
- **Valid JWT, unmapped employee:** 403 when auth required (`API_REQUIRE_AUTH=1` or non-development).
- **Self-heal link:** `POST /api/employees/link-auth` when `VITE_USE_WORKER_WRITES_EMPLOYEES=true` — sets `auth_user_id` only if JWT email matches employee row and row is unlinked or already same user.

---

## 4. Worker architecture

- **Runtime:** Cloudflare Worker (Hono-style routing in `worker/src/index.ts`).
- **Data:** D1 via Drizzle (`worker/src/db/`).
- **Auth:** `worker/src/middleware/auth.ts`, `api-auth.ts`.
- **Reads:** Paginated, explicit columns (Phase 7–9).
- **Writes:** Phase 10 routes; no silent Supabase fallback when SPA flags ON.

Local dev: `cd worker && npx wrangler dev --local --port 8787`  
Secrets: `worker/.dev.vars` from `.dev.vars.example` (JWT secret, optional `API_REQUIRE_AUTH=1`).

---

## 5. D1 architecture

- **Local:** Validated production-shaped data (Phase 6).
- **Remote staging/production IDs:** Still `REPLACE_WITH_*` in `wrangler.toml` until you run `npm run db:create:staging|production` in `worker/` and paste Cloudflare UUIDs.
- **Phase 11:** Wrangler scripts + export verifier + staging bake-off runner added; **no remote migrate/import/deploy executed**.
- **No RLS:** All access control in Worker code.

---

## 6. R2 status

| Bucket | SPA usage | Worker binding | Production migration |
|--------|-----------|----------------|----------------------|
| stage-photos | `stagePhotos.ts` | `STAGE_PHOTOS` (optional) | Not performed |
| attendance-selfies | `attendanceSelfie.ts` + EF | `ATTENDANCE_SELFIES` | Not performed |
| hr-kyc-uploads | HR flows (Supabase) | `HR_KYC_UPLOADS` | Not performed |

- **Flag:** `VITE_USE_WORKER_STORAGE=false` (default).
- **API:** `GET /api/storage/status`, `POST /api/storage/:bucket/upload`, `DELETE /api/storage/:bucket/objects`.
- **Local:** Upload returns **501 NOT_CONFIGURED** without R2 bindings (`npm run test:storage` in worker).

---

## 7. Edge Function status (22 app functions)

| Function | Class | Notes |
|----------|-------|-------|
| request-login-otp | D | Supabase Auth OTP; keep until auth moves |
| verify-login-otp | D | Same |
| create-employee-login | D | Admin auth provisioning |
| update-employee-login-email | D | Auth admin API |
| upload-stage-photo | A → Worker | Worker storage route replaces direct upload when R2 live |
| upload-attendance-selfie | A → Worker | Same |
| send-telegram | B | Needs `TELEGRAM_BOT_TOKEN` |
| telegram-webhook | B | Telegram |
| telegram-broadcast | B | Telegram |
| send-push | B | VAPID / push service |
| push-subscribe | B | Push |
| send-assignment-email | B | Email provider |
| start-case-alerts | B/C | Alert pipeline + DB |
| acknowledge-case-alerts | C | Could move reads/writes to Worker; messaging stays |
| process-alert-escalations | B/C | Cron + external notify |
| test-case-alerts | B | Test hook |
| dashboard-insights | A | Could be Worker aggregate read (optional) |
| gallery / gallery-feed | A | Read feeds → Worker |
| tv-board-feed | A | Read feeds → Worker |
| location-hospital-search | A | Proxy/search → Worker |
| location-bike-route | A | Routing API dependency |

**Legend:** A = Worker replacement viable; B = external service required; C = DB logic on Worker, notify external; D = Supabase infrastructure.

No blind rewrites were applied in this pass; Worker equivalents exist only where prior phases already cover behavior (reads/writes/storage API).

---

## 8. Feature flags matrix

| Domain | Read flag | Write flag | Worker tested (local) | Auth tested (local) | Safe to enable (prod) |
|--------|-----------|------------|------------------------|---------------------|------------------------|
| Core employee/case reads | `VITE_USE_WORKER_READS` | — | Yes (Phase 8) | JWT + dev header | **No** — need prod Worker + JWT secret + mapped employees |
| Notifications read | `VITE_USE_WORKER_NOTIFICATION_READS` | `VITE_USE_WORKER_WRITES_NOTIFICATIONS` | Yes | Partial | **No** |
| Reference data read | `VITE_USE_WORKER_REFERENCE_READS` | hospitals/doctors/employees writes | Yes | Partial | **No** |
| Operations read | `VITE_USE_WORKER_OPERATIONS_READS` | attendance/leave/food/petrol/trips | Yes | Partial | **No** |
| Remaining reads | `VITE_USE_WORKER_REMAINING_READS` | activity/settings/kits/expenses/approvals | Yes | Partial | **No** |
| Case tasks | — | `VITE_USE_WORKER_WRITES_CASE_TASKS` | Yes | Dev header | **No** |
| Cases + claim | — | `VITE_USE_WORKER_WRITES_CASES`, `_CASE_CLAIM` | Yes | Dev header | **No** |
| Storage | — | `VITE_USE_WORKER_STORAGE` | 501 without R2 | N/A | **No** — R2 + public URL required |

**Safe to enable only when:** Worker deployed, D1 loaded, `SUPABASE_JWT_SECRET` set, CORS origin correct, no silent Supabase fallback on enabled paths, smoke tests on staging.

---

## 9. Production prerequisites

1. Create production D1; apply migrations; import data (Phase 5–6 playbook).
2. Deploy Worker (`wrangler deploy --env production`) with D1 binding + secrets.
3. Set `SUPABASE_JWT_SECRET` (Dashboard → Settings → API → JWT Secret).
4. Set `API_CORS_ORIGIN=https://app.malconnexus.com`.
5. Configure R2 buckets + `R2_PUBLIC_BASE_URL` (or signed URL strategy).
6. Hostinger `.env`: `VITE_WORKER_API_URL`, flip flags incrementally on staging first.
7. Resolve Supabase egress / plan before using Supabase for bulk validation.

---

## 10. Rollback procedure

1. Set all `VITE_USE_WORKER_*` and `VITE_USE_WORKER_STORAGE` to **false** in Hostinger env.
2. Redeploy SPA only (`npm run deploy:hostinger`) — Supabase paths remain unchanged.
3. Worker can stay deployed (unused) or be disabled at Cloudflare route level.
4. D1 rollback: restore from export snapshot; do not delete Supabase data.

---

## 11. Safe cutover sequence

1. Deploy Worker + D1 (read-only flags OFF).
2. Staging: enable read flags one domain at a time; verify auth + pagination.
3. Staging: enable low-risk writes → medium → cases → submit-own leave/food.
4. Configure R2; enable `VITE_USE_WORKER_STORAGE`; migrate objects (manual/script — **not** auto-run here).
5. Production: repeat staging order during low-traffic window.
6. Keep Supabase Postgres as backup until burn-in period ends.

---

## 12. Known limitations

- Production JWT parity **not** verified against live Supabase (402 egress).
- `linkAuthUser` on Worker requires JWT `email` claim matching employee email (stricter than opaque Supabase client update in some edge cases).
- Food employee **draft** upsert on Worker still uses admin-gated PUT — submit uses `submit-own` RPC equivalent.
- Case side effects (Telegram/push/email) still hit Edge Functions from SPA/store.
- Attendance selfie upload still defaults to Supabase EF unless storage flag + R2.

---

## 13. Egress / performance (Phase 8+ design)

Worker read APIs avoid:

- `cases.select('*')` unbounded pulls
- Unbounded notifications / activity_log / attendance history
- Browser-direct D1 access
- 1000-row client pagination loops (server-side limits + cursors/limits)

Storage: thumb-only URLs in case JSON; Worker upload path avoids duplicate full-size downloads in UI.

---

## 14. Production cutover checklist

- [ ] Production D1 created and populated
- [ ] Worker production deploy + health/db checks
- [ ] `SUPABASE_JWT_SECRET` configured on Worker
- [ ] SPA `VITE_WORKER_API_URL` points to production Worker
- [ ] Staging flag bake-off completed
- [ ] R2 buckets + CORS + public/signed URL strategy
- [ ] Edge messaging credentials documented (Telegram, email, push)
- [ ] Rollback env vars documented in Hostinger
- [ ] Monitoring on Worker 4xx/5xx and D1 latency
- [ ] Confirm Supabase egress plan / read-only validation window

---

## 15. Local validation commands

```bash
cd worker && npm run db:reset:local && npm run db:validate && npm run db:test
npx wrangler dev --local --port 8787
npm run test:api && npm run test:writes && npm run test:writes:medium && npm run test:writes:cases
npm run test:auth && npm run test:storage
cd .. && npm run build
```

Optional strict auth: add to `worker/.dev.vars`: `JWT_SECRET=local-dev-only-secret`, `API_REQUIRE_AUTH=1`.
