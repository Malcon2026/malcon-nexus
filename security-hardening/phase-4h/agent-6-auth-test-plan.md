# Agent 6 — Auth test matrix

## Local (safe)

| Test | Command / script | Expect |
|------|------------------|--------|
| AuthZ regression | `node scripts/test-security-authz.mjs` | Cross-employee reads 403 |
| Worker JWT | `node scripts/test-worker-auth.mjs` | Invalid/expired 401 |
| Phase 1 extended | `node scripts/phase1-security-validation.mjs` | IDOR probes |
| ECS TD builder | `npm run test:ecs-task-def` | 9 pass |

## Production (read-only / non-destructive)

| Probe | Result criterion |
|-------|------------------|
| `GET /health` | 200 |
| `GET /health/db` | 200, `database: true` |
| `GET /api/employees` no auth | 401 |
| Bearer `a.b.c` | 401 |
| `POST /api/telegram/webhook` no secret | 401 |
| Invalid cron secret | 401 |

## Not run on prod

- Login brute-force, OTP consumption, or write IDOR with real employee data.
