# Agent 2 — IAM & secrets final audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1 · **Captured:** 2026-10-18T12:21:53+0530

## IAM task role (`malconEcsTaskRole`)

| Check | Live evidence | Result |
|-------|---------------|--------|
| Attached AWS managed policies | **None** | **PASS** |
| Inline S3 policy | `malconNexusTaskS3Secrets` — three bucket prefixes + list for health | **PASS** |
| Secrets Manager on task role | **Absent** (4C) | **PASS** |

Artifacts: `live-capture/iam-malconEcsTaskRole-attached.json`, `live-capture/iam-task-inline-s3secrets.json`

## IAM execution role (`ecsTaskExecutionRole`)

| Check | Result |
|-------|--------|
| Scoped CloudWatch Logs on `/ecs/malcon-nexus-api` | **PASS** |
| `GetSecretValue` on `malcon-nexus/api-env*` only | **PASS** |

Artifact: `live-capture/iam-exec-inline-logssecrets.json`

## ECS secrets injection (task def `:6`)

Sensitive keys referenced only via `secrets[]` JSON keys (no plaintext in `environment[]`):

- `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALERT_CRON_SECRET`

Plain env: `ENVIRONMENT=production`, `API_CORS_ORIGIN=https://app.malconnexus.com`, S3 bucket names, `PORT`, `AWS_REGION`.

Artifact: `live-capture/task-def-6-summary.json`

## Secrets Manager metadata

| Item | Value |
|------|--------|
| Secret | `malcon-nexus/api-env` |
| AWSCURRENT | `b9e73e2a-d21d-4b0c-9b19-ae475eb35513` (created **2026-10-18T12:15:08+05:30**) |
| AWSPREVIOUS | `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` (DB cutover + pre-4H JWT era) |
| LastChangedDate | 2026-10-18T12:15:08+05:30 (4H JWT rotation) |

Artifacts: `live-capture/sm-describe.json`, `live-capture/sm-versions.json`

## JWT dual-secret window (metadata only — no values printed)

| Field | `JWT_SECRET` | `SUPABASE_JWT_SECRET` |
|-------|--------------|------------------------|
| Segment count | 2 | 2 |
| Segment lengths | 43, **27** | 43, **27** |
| Legacy 27-char segment present | **Yes** | **Yes** |
| Primary length | 43 | 43 |

Artifact: `live-capture/sm-jwt-metadata.json`

### 8h TTL since 4H cutover

| Anchor | Timestamp |
|--------|-----------|
| 4H SM AWSCURRENT created | 2026-10-18T12:15:08+05:30 |
| 4I audit time | 2026-10-18T12:21:53+0530 |
| Elapsed | **~7 minutes** (≪ 8 hours) |

**Classification:** Legacy segment removal **DEFERRED** — still inside the intentional dual-verify window; not overdue for 4I cleanup.

## DATABASE_URL host (hostname only)

| Check | Result |
|-------|--------|
| SM host points to prod encrypted RDS | **PASS** (`malcon-nexus-db-encrypted…`) |

Artifact: `live-capture/sm-db-host-metadata.json`

## Verdict

**PASS WITH DEFERRED** — Least-privilege IAM and ECS injection match 4B/4C/4H design. Dual JWT segments in SM are **expected** until ~8h post-rotation; do **not** remove in 4I.
