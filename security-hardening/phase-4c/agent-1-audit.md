# Agent 1 — AWS current-state audit (read-only)

**Account:** 353728888679  
**Region:** ap-south-1  
**Date:** Phase 4C pre-migration  

## ECS

| Item | Value |
|------|--------|
| Cluster | `malcon-nexus` |
| Service | `malcon-nexus-api` |
| Live task definition | `malcon-nexus-api:4` |
| Desired / running | 1 / 1 |
| Image | `353728888679.dkr.ecr.ap-south-1.amazonaws.com/malcon-nexus-api:latest` (ARM64) |

## Container `environment[]` names (revision :4)

No `secrets[]` entries (`null`).

| Name | Sensitive |
|------|-----------|
| PORT | No |
| AWS_REGION | No |
| ENVIRONMENT | No |
| API_CORS_ORIGIN | No |
| S3_BUCKET_STAGE_PHOTOS | No |
| S3_BUCKET_ATTENDANCE_SELFIES | No |
| S3_BUCKET_HR_KYC_UPLOADS | No |
| MALCON_API_SECRET_ARN | Config (enables runtime SM fetch in current image) |
| DATABASE_URL | **Yes** |
| TELEGRAM_BOT_TOKEN | **Yes** |
| TELEGRAM_WEBHOOK_SECRET | **Yes** |

**Not in task def env (present only via runtime SM merge today):** `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `ALERT_CRON_SECRET`.

## Secrets Manager `malcon-nexus/api-env`

**ARN:** `arn:aws:secretsmanager:ap-south-1:353728888679:secret:malcon-nexus/api-env-iyxZEl`  

**JSON keys (names only):**  
`ALERT_CRON_SECRET`, `API_CORS_ORIGIN`, `AWS_REGION`, `DATABASE_URL`, `ENVIRONMENT`, `JWT_SECRET`, `S3_BUCKET_ATTENDANCE_SELFIES`, `S3_BUCKET_HR_KYC_UPLOADS`, `S3_BUCKET_STAGE_PHOTOS`, `SUPABASE_JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

No `LOGIN_OTP_SECRET` in secret.

## IAM

| Role | Attached AWS managed | Inline |
|------|---------------------|--------|
| `malconEcsTaskRole` | *(none)* | `malconNexusTaskS3Secrets` — includes S3 + **`ReadApiSecret`** (`GetSecretValue` / `DescribeSecret` on `malcon-nexus/api-env*`) |
| `ecsTaskExecutionRole` | `AmazonECSTaskExecutionRolePolicy` | `malconNexusEcsExecutionLogsSecrets` — scoped logs + **`GetSecretValue`** on `malcon-nexus/api-env*` |

## Runtime Secrets Manager reads

Current container image calls `loadMalconApiSecrets()` at startup with default secret id when `MALCON_API_SECRET_ARN` is set (and legacy default `malcon-nexus/api-env` in code before 4C code change). Task role **`ReadApiSecret`** is used for that fetch.

## Findings summary

1. Three sensitive vars are **plaintext in ECS task definition**; JWT/cron secrets are **not** in task def but loaded at runtime from SM via task role.
2. ECS `secrets[]` injection is **not** used yet.
3. Execution role is **ready** for ECS secret injection.
4. Task role still has **scoped** SM read (not `SecretsManagerReadWrite`).
