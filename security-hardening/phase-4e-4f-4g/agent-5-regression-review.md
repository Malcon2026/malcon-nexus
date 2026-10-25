# Agent 5 — Regression review (4B / 4C / 4D vs current)

**Live re-check:** 2026-10-18

## Phase 4B (network / IAM)

| Control | Expected | Live |
|---------|----------|------|
| ECS subnets | Private | `subnet-0b85d704dd4411184`, `subnet-07ad0e3edcf0a9067` |
| assignPublicIp | DISABLED | **DISABLED** |
| ECS 1/1 | Running | **1/1**, rollout stable |
| ALB target | Healthy | **healthy** |
| RDS public | false | **false** on prod instance |
| SG layering | ALB / ECS / RDS split | Unchanged ARNs from 4B |

**Regression:** None observed.

## Phase 4C (secrets injection)

| Control | Expected | Live |
|---------|----------|------|
| Task definition | `malcon-nexus-api:5` | **:5** |
| secrets[] | From `malcon-nexus/api-env` | Present in task def (not re-read values) |
| Plaintext DATABASE_URL in env | Absent | Confirmed by 4C/4D tooling |

**Regression:** None observed.

## Phase 4D-2 (encrypted RDS)

| Control | Expected | Live |
|---------|----------|------|
| Production DB | `malcon-nexus-db-encrypted` | **available**, `StorageEncrypted=true` |
| Legacy `malcon-nexus-pg` | Retained, not prod pointer | Still **available** (metrics still emit) |
| SM DATABASE_URL change | Done in 4D-2 | **This phase: no SM writes** |

**Regression:** None observed; **4D-2 prod DB intact**.

## New phase scope boundaries

- **No** DATABASE_URL / Secrets Manager mutations.
- **No** RDS migration, snapshot delete, JWT rotation.
- **No** ECS networking / SG redesign beyond WAF association scope.

## Direct ALB bypass (unchanged risk)

- ALB still internet :80 HTTP — mitigated this phase by WAF on API GW (primary path), not ALB association (optional follow-up).
