# Cutover Agent 2 — Secrets & ECS pointer (Phase 4D-2 cutover)

## Pre-cutover

| Check | Result |
|-------|--------|
| Secret `malcon-nexus/api-env` AWSCURRENT version | `172df240-0daa-456f-aa0b-e219618d0186` |
| `DATABASE_URL` host (host only) | `malcon-nexus-pg.cpumo6uq2a4o.ap-south-1.rds.amazonaws.com` |
| DB name / sslmode pattern | `malconnexus` / `require` |
| ECS service | `malcon-nexus-api`, **1/1**, task def **`malcon-nexus-api:5`**, rollout **COMPLETED** |

## Cutover actions (writer)

1. **Secrets Manager:** new version **`6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff`** — **only** `DATABASE_URL` host changed to  
   `malcon-nexus-db-encrypted.cpumo6uq2a4o.ap-south-1.rds.amazonaws.com` (user, password, db, sslmode unchanged).
2. **ECS:** `force-new-deployment` on `malcon-nexus/malcon-nexus-api` with task def **`:5`** (no new image).

## Post-cutover

| Check | Result |
|-------|--------|
| AWSCURRENT version | `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` |
| AWSPREVIOUS (rollback) | `172df240-0daa-456f-aa0b-e219618d0186` (source RDS host) |
| `DATABASE_URL` host | encrypted clone endpoint |
| ECS rollout | **COMPLETED**, **1/1** on `:5` |

No JWT or other secret keys modified.
