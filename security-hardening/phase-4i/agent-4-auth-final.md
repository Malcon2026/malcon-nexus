# Agent 4 — Authentication & authorization final audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1 · **API:** `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com`

## Production probes (no credentials)

| Probe | HTTP | Result |
|-------|------|--------|
| `GET /health` | 200 | **PASS** |
| `GET /health/db` | 200 | **PASS** |
| `GET /api/employees` (no auth) | 401 | **PASS** |
| `GET /api/employees` (malformed Bearer) | 401 | **PASS** |
| `POST /api/telegram/webhook` (no secret) | 401 | **PASS** |
| `GET /api/employees` + `X-Malcon-Dev-Identity` | 401 | **PASS** |

Artifact: `live-capture/probe-results.txt`

## Code review (repo)

| Control | Location | Result |
|---------|----------|--------|
| Multi-secret JWT verify | `worker/src/lib/jwtSecrets.ts`, `jwt.ts`, `middleware/auth.ts` | **PASS** |
| Primary JWT ≥32 chars in production | `worker/src/lib/productionSecurity.ts` | **PASS** |
| Dev identity header blocked in prod | `worker/src/middleware/auth.ts` (`ENVIRONMENT !== 'development'`) | **PASS** |
| CORS single origin in prod | `API_CORS_ORIGIN=https://app.malconnexus.com` in task def | **PASS** |
| Telegram webhook + cron secrets required at startup | `productionSecurity.ts` | **PASS** |

4H authorization fixes documented in `security-hardening/phase-4h/agent-3-authorization-audit.md` (IDOR routes, roster scoping, link-auth).

## JWT configuration (live, metadata only)

- AWSCURRENT primary segment **43** chars; dual-verify tail **27** chars (comma-separated) on both `JWT_SECRET` and `SUPABASE_JWT_SECRET`.
- ECS task **`:6`** injects SM keys; no `JWT_SECRET_PREVIOUS` env (optional path in `ecs-task-definition.mjs` unused).

Artifact: `live-capture/sm-jwt-metadata.json`, `live-capture/task-def-6-summary.json`

## Not run (by design)

| Check | Reason |
|-------|--------|
| `scripts/test-security-authz.mjs` on production | Uses local seed IDs and mutating POSTs — not read-only |
| Authenticated IDOR matrix on prod | Requires real user JWTs (secrets/creds prohibited in 4I) |

## Verdict

**PASS WITH DEFERRED** — Fail-closed authN on edge probes; code matches 4H rotation and authZ hardening. Full authZ regression remains a **non-prod or credentialed** exercise.
