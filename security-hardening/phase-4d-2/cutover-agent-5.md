# Cutover Agent 5 — Security regression (Phase 4D-2 cutover)

## Changes in scope

| Change | Executed? |
|--------|-----------|
| `DATABASE_URL` host → encrypted RDS | **Yes** |
| ECS redeploy (`:5`, secrets[]) | **Yes** |
| Delete RDS / snapshots | **No** |
| JWT / Telegram secret rotation | **No** |
| SG / VPC / WAF / TLS / network | **No** |
| Backup retention / Multi-AZ | **No** |
| ECS public IP / task def revision bump | **No** |

## Regression matrix

| Control | Expected | Post-cutover |
|---------|----------|--------------|
| ECS task def | `malcon-nexus-api:5`, secrets from SM | **PASS** |
| RDS encryption at rest (production data path) | true | **PASS** (app on `malcon-nexus-db-encrypted`) |
| RDS publicly accessible | false (both instances) | **PASS** |
| Unauthenticated API | 401 on protected routes | **PASS** |
| Telegram webhook without secret | 401 | **PASS** |
| Dev identity header in production | 401 | **PASS** |
| Secret values in repo artifacts | none | **PASS** |
| Source RDS retained for rollback | yes | **PASS** |

**Verdict:** **PASS** — no prohibited security regressions observed.
