# PHASE 4C RESULT

## Executive result

**PASS** — Production ECS service runs **`malcon-nexus-api:5`** with sensitive configuration in **`secrets[]`** only; **`malcon-nexus-api:4`** preserved; API and database health validated.

---

## Parallel agents (summary)

| Agent | Output | Key finding |
|-------|--------|-------------|
| 1 — AWS audit | `agent-1-audit.md` | `:4` had plaintext DATABASE_URL + Telegram vars; JWT/cron only via runtime SM |
| 2 — Code audit | `agent-2-code-audit.md` | App reads `process.env`; `loadMalconApiSecrets` optional after ECS injection |
| 3 — Migration design | `agent-3-migration-plan.md` | Six keys via `secrets[]`; tooling in `ecs-task-definition.mjs` |
| 4 — Security review | `agent-4-security-review.md` | No SM writes; rollback to `:4` |
| 5 — Deployment plan | `agent-5-deployment-plan.md` | Checklist executed (see Validation) |

---

## AWS changes

| Resource | Change |
|----------|--------|
| ECS task definition | Registered **`malcon-nexus-api:5`** (injection); **`:4` unchanged** |
| ECS service `malcon-nexus-api` | Updated to revision **5**; rolling deploy completed |
| ECR `malcon-nexus-api:latest` | New image ( `loadSecrets` gate + startup config alignment) |
| IAM `malconEcsTaskRole` | Inline policy **without** Secrets Manager (`ReadApiSecret` removed) |
| IAM `ecsTaskExecutionRole` | **Unchanged** (already had scoped `GetSecretValue`) |

**Not changed:** Secrets Manager values, RDS, networking, ALB, API Gateway, SGs, NAT/endpoints.

---

## Task definitions

| | Revision | Notes |
|---|----------|--------|
| **Previous (rollback)** | `malcon-nexus-api:4` | Plaintext sensitive `environment[]`; no `secrets[]` |
| **Current** | `malcon-nexus-api:5` | Plain env = non-sensitive only; six `secrets[]` JSON key refs |

---

## Secrets migrated (names only)

Moved from plaintext `environment[]` (or runtime-only SM) into ECS **`secrets[]`** referencing `malcon-nexus/api-env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPABASE_JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ALERT_CRON_SECRET`

**Plain `environment[]` (rev :5):** `PORT`, `AWS_REGION`, `ENVIRONMENT`, `API_CORS_ORIGIN`, `S3_BUCKET_STAGE_PHOTOS`, `S3_BUCKET_ATTENDANCE_SELFIES`, `S3_BUCKET_HR_KYC_UPLOADS`

**Removed:** `MALCON_API_SECRET_ARN` (no runtime task-role SM fetch in production image path)

---

## IAM

| Role | Before 4C | After 4C |
|------|-----------|----------|
| **Task** `malconEcsTaskRole` | S3 scoped + `ReadApiSecret` (Get/Describe on `api-env*`) | **S3 only** (four Sids) |
| **Execution** `ecsTaskExecutionRole` | ECS execution + scoped logs + `GetSecretValue` on `api-env*` | **Same** |

---

## Validation

| Test | Result |
|------|--------|
| Account / region gate | **PASS** (`353728888679`, `ap-south-1`) |
| ECS desired = running | **PASS** (1/1) |
| PRIMARY rollout COMPLETED on `:5` | **PASS** |
| ALB target healthy | **PASS** |
| `GET /health` | **PASS** (200) |
| `GET /health/db` | **PASS** (200, `database: true`) |
| Unauthenticated `/api/employees` | **PASS** (401) |
| Telegram webhook without secret | **PASS** (401) |
| Post-deploy task def audit | **PASS** (see Security verification) |
| Task role has no SM permissions | **PASS** |
| S3 / authenticated smoke | **NOT RUN** (no prod JWT in this session) |
| `test-security-authz.mjs` on prod | **NOT RUN** (writes + local seed IDs) |

---

## Security verification

**No sensitive production secret values remain in ECS task-definition `environment[]` for the live revision (`:5`).** — **PASS**

Verified via `aws ecs describe-task-definition malcon-nexus-api:5`: sensitive names appear only under **`secrets[]`** with `valueFrom` ARNs; plain env names are non-sensitive configuration only. Generated repo artifact `generated-task-definition.json` contains no secret values.

---

## Incident during deploy (resolved)

First tasks on `:5` exited on startup: **`ProductionConfigError`** for JWT length (SM JWT keys are **27** characters; newly deployed image enforced **≥32** while plaintext `:4` had relied on an older image without that check). **No rollback to `:4` required** — adjusted production startup validation to require presence with minimum length **16** (no secret rotation), rebuilt/pushed image, redeployed `:5` successfully.

---

## Rollback

```bash
aws ecs update-service --cluster malcon-nexus --service malcon-nexus-api \
  --task-definition malcon-nexus-api:4 --force-new-deployment --region ap-south-1
```

Re-apply task role inline policy **with** `ReadApiSecret` if rolling back to an image that calls `loadMalconApiSecrets()` with `MALCON_API_SECRET_ARN`.

Do **not** delete revision `:5` or alter Secrets Manager.

---

## Repository / tooling delivered

- `scripts/aws/ecs-task-definition.mjs` — build + pre-register plaintext scan
- `scripts/aws/register-ecs-task-secrets.mjs` — register/deploy Phase 4C task def
- `aws-api/src/loadSecrets.ts` — fetch only when `MALCON_API_SECRET_ARN` set
- `scripts/aws/ecs-task-s3-secrets-policy.json` — task role without SM
- `security-hardening/phase-4c/generated-task-definition.json` — safe template (no values)

---

## Remaining risks

- JWT signing material in SM remains **27 characters** (legacy); consider **length hardening in a future secret-rotation phase** (not done in 4C).
- `deploy-ecs-cloudfront.mjs` still embeds plaintext if used unchanged — prefer `register-ecs-task-secrets.mjs` until deploy script is updated.
- ALB HTTP only, no WAF, RDS encryption, monitoring/alarms, legacy SG `sg-068dd8d11ba52fa2a`, single NAT (from 4B).
- Local `.ecs-task-def.json` may contain secrets if old deploy script run — keep gitignored.

---

## NEXT PHASE (not executed)

1. **Secret rotation / length** — lengthen JWT material in SM with coordinated client/session plan.
2. **Deploy script parity** — refactor `deploy-ecs-cloudfront.mjs` to use `ecs-task-definition.mjs`.
3. **4D+** — ALB TLS, WAF, RDS encryption, CloudWatch alarms, legacy SG cleanup.

**STOP.**
