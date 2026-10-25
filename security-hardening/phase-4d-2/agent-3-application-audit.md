# Agent 3 — Application / secrets audit (Phase 4D-2)

No secret values recorded.

## Secrets Manager

| Item | Detail |
|------|--------|
| Secret name | `malcon-nexus/api-env` |
| ARN suffix | `malcon-nexus/api-env-iyxZEl` |
| Current version | `172df240-0daa-456f-aa0b-e219618d0186` (AWSCURRENT) |
| Keys (from tooling) | `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `TELEGRAM_*`, `ALERT_CRON_SECRET`, optional `LOGIN_OTP_SECRET` |

**Production ECS (`malcon-nexus-api:5`):** sensitive keys injected via `secrets[]` only (`scripts/aws/ecs-task-definition.mjs`).

## DATABASE_URL usage

| Location | Role |
|----------|------|
| `worker/src/env.ts` | Optional `DATABASE_URL` on `Env` |
| `worker/src/db/pgPool.ts` | Pool from `env.DATABASE_URL`; throws if missing |
| `worker/src/db/rawSql.ts` | `usesPostgres(env)` gates Postgres code paths |
| `aws-api/src/env-node.ts` | Maps `DATABASE_URL` for Node server |
| `aws-api/src/server.ts` | Loads optional SM via `loadSecrets.ts` when `MALCON_API_SECRET_ARN` set (not set on ECS `:5`) |
| `scripts/aws/pg-connection.mjs` | RDS CA bundle TLS (`aws/certs/ap-south-1-bundle.pem`), `createPgPoolOptions()` |
| `scripts/aws/ensure-rds-database.mjs` | Default app DB name **`malconnexus`** |

## Health / DB probe

- Route: `GET /health/db` (`worker/src/routes/health.ts`)
- Query: `SELECT COUNT(*) FROM employees`
- Response fields: `ok`, `database`, `employees` (count)
- Production allowed when `usesPostgres(env)` is true

## Cutover impact (future)

- App uses **hostname in `DATABASE_URL`** only; encrypted clone keeps same credentials and database name if restored from snapshot.
- TLS: Node `pg` uses regional RDS CA bundle (not `sslmode=require` in URL alone); no app code change required for encryption-at-rest cutover.
- **This phase did not modify** Secrets Manager or ECS.

## Artifacts

- `pre-change/task-definition-5-metadata.json` — secret **names** only
- `pre-change/secret-metadata.json` — describe-secret (no SecretString)
