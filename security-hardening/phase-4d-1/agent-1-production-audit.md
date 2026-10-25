# Agent 1 — Production audit (read-only)

**Account:** 353728888679  
**Region:** ap-south-1  
**Phase:** 4D-1 pre-change  
**Captured:** `pre-change/ecs-service.json`, `pre-change/task-definition-5-redacted.json`, `pre-change/rds.json`

## ECS

| Item | Value |
|------|--------|
| Cluster | `malcon-nexus` |
| Service | `malcon-nexus-api` |
| Live task definition | **`malcon-nexus-api:5`** |
| Desired / running | 1 / 1 |
| PRIMARY rollout | **COMPLETED** (`ecs-svc/7000224435466841008`) |
| Network | Private subnets `subnet-0b85d704dd4411184`, `subnet-07ad0e3edcf0a9067`; SG `sg-0baa11bbe7369985a`; **assignPublicIp DISABLED** (4B posture intact) |

## Task definition `:5` (names only)

**`environment[]`:** `AWS_REGION`, `PORT`, `S3_BUCKET_*`, `ENVIRONMENT`, `API_CORS_ORIGIN` — no sensitive names.

**`secrets[]` (6):** `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALERT_CRON_SECRET`.

## Load balancer / API edge

| Check | Result |
|-------|--------|
| Target group | `malcon-nexus-api` |
| Target health | At least one **healthy** target (one draining during prior rollout) |
| Public HTTPS API | `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com` (from `aws/provision-output/deployment.json`) |

## RDS `malcon-nexus-pg`

| Setting | Value | 4D-1 target |
|---------|--------|-------------|
| Status | `available` | — |
| Engine | PostgreSQL 16.15 | — |
| Multi-AZ | **false** | Defer (see agent-4) |
| BackupRetentionPeriod | **0** | ≥ 7 |
| DeletionProtection | **false** | **true** |
| StorageEncrypted | false | Out of scope |
| PubliclyAccessible | false | — |
| VPC SG | `sg-078ca764ce05bc9c5` | Unchanged |

## CloudWatch alarms

No metric alarms matching `malcon` / `ecs` / `rds` in ap-south-1 (empty set). Monitoring alarms remain a future phase.

## Deployment history (recent)

Service events show successful rollout to `:5` on 2026-10-18 with steady state reached after task replacement.

## Findings

1. **ECS secrets posture (4C) is live and healthy on revision 5.**
2. **RDS has no automated backups** (retention 0) and **deletion protection off** — safe in-place fixes required in 4D-1.
3. **No CloudWatch alarms** for ECS/RDS/API.
4. Phase 4B private networking on ECS service **unchanged**.
