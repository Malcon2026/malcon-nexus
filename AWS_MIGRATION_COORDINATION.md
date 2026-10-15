# Malcon Nexus — AWS migration coordination

**Branch:** `cursor/aws-migration-coordination-cbb2`  
**Production D1:** untouched (Cloudflare fallback remains)  
**RDS:** assumed migrated externally (`malconnexus`, 31 tables)

## Task status

| Task | Status | Notes |
|------|--------|--------|
| **1 — AWS API deployment** | Scaffold + deploy scripts | `aws-api/` Docker + App Runner config; needs AWS credentials to push ECR / create service |
| **2 — Auth + Telegram + S3** | Config wired in code | JWT/OTP/Telegram via same env keys as Worker; S3 via `storageHooks` + Secrets Manager JSON |
| **3 — Frontend AWS cutover** | Ready | `VITE_USE_AWS_BACKEND`, `VITE_API_BASE_URL`, `deploy:hostinger:aws` |

## Architecture (no new product architecture)

- Shared router: `worker/src/app.ts` (`handleAppRequest`)
- Cloudflare: `worker/src/index.ts` → D1 + R2
- AWS: `aws-api/src/server.ts` → RDS PostgreSQL (`pg` + Drizzle `schema.pg.ts`) + S3

Regenerate Postgres schema after D1 schema edits:

```bash
node scripts/generate-pg-drizzle-schema.mjs
```

## Deploy API (Task 1)

1. Fill `aws-api/.env.example` or create Secrets Manager secret (JSON keys in file).
2. `JWT_SECRET` / `SUPABASE_JWT_SECRET` **must match** production Worker signing secret.
3. Build & push:

```bash
cd aws-api && npm install && npm run build
AWS_REGION=ap-south-1 node scripts/deploy-apprunner.mjs
```

4. Create **App Runner** service (preferred) from ECR image, port **8080**, health **`/health`**, instance role: RDS (via secret URL), S3 buckets, Secrets Manager read.

Alternative: run the same container on **ECS Fargate** or **EC2** if App Runner is blocked on the account.

## Deploy SPA (Task 3)

After you have the public HTTPS API URL:

```bash
cp .env.production.aws.example .env.production.aws
# edit VITE_API_BASE_URL=https://....amazonaws.com
npm run deploy:hostinger:aws
```

## Blockers (this environment)

- No AWS CLI / credentials in the Cloud Agent VM → **no live deploy or HTTPS URL** from this run.
- RDS schema must match D1-shaped Drizzle (`schema.pg.ts`) or queries need further Postgres-specific fixes beyond `caseScope` JSON handling.
- Validate row counts on AWS: `GET /health/db` (enabled on Postgres runtime).
