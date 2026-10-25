# Agent 3 — Task definition migration design

## Target split

### `environment[]` (non-sensitive only)

- `PORT`
- `AWS_REGION`
- `ENVIRONMENT`
- `API_CORS_ORIGIN`
- `S3_BUCKET_STAGE_PHOTOS`
- `S3_BUCKET_ATTENDANCE_SELFIES`
- `S3_BUCKET_HR_KYC_UPLOADS`
- Optional if ever set: `SUPABASE_JWT_AUD`, `PGSSL`, `PG_POOL_MAX`, `API_REQUIRE_AUTH`

**Remove:** `MALCON_API_SECRET_ARN`, all sensitive keys.

### `secrets[]` (from `malcon-nexus/api-env` JSON keys)

| Env name | SM JSON key |
|----------|-------------|
| DATABASE_URL | DATABASE_URL |
| JWT_SECRET | JWT_SECRET |
| SUPABASE_JWT_SECRET | SUPABASE_JWT_SECRET |
| TELEGRAM_BOT_TOKEN | TELEGRAM_BOT_TOKEN |
| TELEGRAM_WEBHOOK_SECRET | TELEGRAM_WEBHOOK_SECRET |
| ALERT_CRON_SECRET | ALERT_CRON_SECRET |

**valueFrom format:**  
`arn:aws:secretsmanager:ap-south-1:353728888679:secret:malcon-nexus/api-env-iyxZEl:<KEY>::`

## Execution role

Existing inline `malconNexusEcsExecutionLogsSecrets` — **no change** required.

## Task role

After deploy + image with `loadMalconApiSecrets` gated on `MALCON_API_SECRET_ARN`:

- Remove **`ReadApiSecret`** statement from `scripts/aws/ecs-task-s3-secrets-policy.json`.
- Re-apply via `ensure-ecs-roles.mjs --execute`.

## Code changes

1. `ecs-task-definition.mjs` + `register-ecs-task-secrets.mjs`
2. `loadSecrets.ts` — skip runtime fetch without `MALCON_API_SECRET_ARN`
3. **Docker rebuild required** only to pick up `loadSecrets.ts` for task-role SM removal (task def injection works without rebuild).

## Deploy script follow-up

`deploy-ecs-cloudfront.mjs` should be updated to use `ecs-task-definition.mjs` (future full deploys); Phase 4C uses `register-ecs-task-secrets.mjs` + optional ECR push.

## Pre-deploy gate

`assertNoPlaintextSecrets()` fails if blocklisted names appear in `environment[]` or required keys missing from `secrets[]`.
