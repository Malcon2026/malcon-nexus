# Agent 2 — Application / repository audit

## Startup path (`aws-api`)

1. `server.ts` → `await loadMalconApiSecrets()` then `createNodeEnv()` → `assertProductionSecurityConfig()`.
2. `createNodeEnv()` reads **process.env** for all production config (`aws-api/src/env-node.ts`).
3. Worker routes/services consume `Env` (DATABASE_URL, JWT, Telegram, ALERT_CRON_SECRET, S3 buckets, etc.).

## `loadMalconApiSecrets()` (`aws-api/src/loadSecrets.ts`)

- Uses `@aws-sdk/client-secrets-manager` **`GetSecretValue`**.
- Merges JSON keys into `process.env` only when the key is **missing or empty** (does not overwrite ECS-injected values).
- **Phase 4C change:** fetch runs only when `MALCON_API_SECRET_ARN` is set (Lightsail/local); ECS production omits this var so runtime SM is skipped after redeploy.

## Required production variables (`productionSecurity.ts`)

| Variable | Required |
|----------|----------|
| JWT_SECRET or SUPABASE_JWT_SECRET (≥32 chars) | Yes |
| API_CORS_ORIGIN (explicit, not `*`) | Yes |
| TELEGRAM_WEBHOOK_SECRET | Yes |
| ALERT_CRON_SECRET | Yes |
| DATABASE_URL | Implicit (DB pool) |
| TELEGRAM_BOT_TOKEN | Runtime features (503 if missing) |

## Deployment tooling

| Script | Behavior today |
|--------|----------------|
| `scripts/aws/deploy-ecs-cloudfront.mjs` | Loads SM JSON, embeds **plaintext** into `environment[]`, writes `.ecs-task-def.json`, registers task def |
| `scripts/aws/deploy-lightsail-api.mjs` | Sets `MALCON_API_SECRET_ARN` + env from SM (non-ECS path) |
| `scripts/aws/sync-api-secrets.mjs` | Updates SM from local files (not used in 4C deploy) |

## New tooling (Phase 4C prep)

- `scripts/aws/ecs-task-definition.mjs` — builds `secrets[]` + plain `environment[]`, pre-register scan.
- `scripts/aws/register-ecs-task-secrets.mjs` — register (and optional deploy) without embedding secret values.

## Conclusion

- ECS **`secrets[]`** satisfies the app if all sensitive keys are injected before startup.
- **`loadMalconApiSecrets`** is a **fallback** for Lightsail/dev; production ECS should **not** rely on task-role SM after code + task def update.
- No authentication logic changes required.
