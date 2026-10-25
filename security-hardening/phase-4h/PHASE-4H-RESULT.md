# PHASE 4H RESULT

## Status

**PASS WITH DEFERRED** — JWT rotated with dual-verify window, auth/authZ code deployed on ECS, production probes green. **Deferred:** remove legacy JWT segment from SM after 8h TTL; optional `JWT_SECRET_PREVIOUS` ECS inject; local authZ scripts not re-run against prod.

---

## Executive summary

| Workstream | Outcome |
|------------|---------|
| JWT audit + rotation | New primary segment **43 chars**; legacy **27-char** verify tail via comma-separated SM value |
| Dual-secret verify | `listJwtVerificationSecrets` + `verifySupabaseAccessTokenWithSecrets` |
| Production gate | Primary JWT segment **≥32 chars** enforced at startup |
| AuthZ | IDOR fixes on HR reads, case-alert ack, telegram/case-alert notify, link-auth |
| ECS deploy | Task definition **`malcon-nexus-api:6`** (image push + register); service stable |
| Infra regression | WAF on ALB, 7 alarms, private ECS tasks, encrypted RDS unchanged |

---

## Account & anchors

| Item | Value |
|------|--------|
| Account | 353728888679 |
| Region | ap-south-1 |
| API Gateway | `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com` |
| ECS | **`malcon-nexus-api:6`** (rolled from `:5`) |
| Secrets Manager | `malcon-nexus/api-env` |
| RDS | `malcon-nexus-db-encrypted` (encrypted, private, available) |

---

## Secrets Manager (metadata only)

| Version ID | Stage | Purpose |
|------------|-------|---------|
| `b9e73e2a-d21d-4b0c-9b19-ae475eb35513` | AWSCURRENT | Post-4H JWT (primary len 43, 2 segments) |
| `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` | AWSPREVIOUS | Pre-4H JWT (primary len 27) — **JWT rollback target** |
| `172df240-0daa-456f-aa0b-e219618d0186` | (historical) | **DB cutover era only** — not for JWT rollback |

Keys updated in merge: **`JWT_SECRET`**, **`SUPABASE_JWT_SECRET`** only. `DATABASE_URL` untouched.

---

## Code changes (high level)

- `worker/src/lib/jwtSecrets.ts` — parse primary + comma/previous secrets.
- `worker/src/lib/jwt.ts` — multi-secret verify.
- `worker/src/lib/productionSecurity.ts` — min primary length 32.
- AuthZ route/service hardening (employees roster, operations lists, case alerts, telegram notify, link-auth, dev identity header blocked in prod).
- `scripts/aws/ecs-task-definition.mjs` — optional `JWT_SECRET_PREVIOUS` inject.

Agent audits: `agent-1-jwt-audit.md` … `agent-6-auth-test-plan.md`.

---

## Validation

| Check | Result |
|-------|--------|
| ECS 1/1, rollout COMPLETED (`:6`) | **PASS** |
| `assignPublicIp` DISABLED, private subnets | **PASS** |
| RDS encrypted / private | **PASS** |
| `GET /health` | **PASS** (200) |
| `GET /health/db` | **PASS** (200, database true) |
| `/api/employees` unauthenticated | **PASS** (401) |
| Malformed Bearer JWT | **PASS** (401) |
| Telegram webhook no secret | **PASS** (401) |
| WAF on ALB | **PASS** |
| CloudWatch alarms (7) | **PASS** |
| `npm run test:ecs-task-def` | **PASS** (9 tests) |
| `git diff --check` | **PASS** |

---

## Rollback

1. **JWT / SM:** Move `AWSCURRENT` to version `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` or put-secret-value restoring single 27-char JWT keys (do not revert `DATABASE_URL` to `172df240…` unless doing a DB cutover rollback).
2. **ECS:** `update-service` to task definition `malcon-nexus-api:6` (or prior image digest) + force-new-deployment.
3. **Code:** Revert auth/JWT commits if rolling back application logic.

---

## Prohibitions honored

- No TLS / 4G work
- No `DATABASE_URL` / RDS migration / delete `malcon-nexus-pg`
- No Phase 4I / final audit
- No git commit (per instruction)

---

## Deferred follow-ups

- After **~8 hours**, drop legacy JWT segment from SM (single strong secret).
- Re-run `scripts/test-security-authz.mjs` against local/staging with seeded employees when convenient.
- Subscribe SNS `malcon-nexus-ops-alerts` if not already done (from 4E).
