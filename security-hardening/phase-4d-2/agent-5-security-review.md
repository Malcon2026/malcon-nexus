# Agent 5 — Security review (Phase 4D-2)

## Classification

| Action | Verdict |
|--------|---------|
| Read-only RDS/ECS/SM describe | **SAFE** |
| Manual snapshot of production RDS | **SAFE** (standard backup; no instance replace) |
| Encrypted snapshot copy (AWS managed RDS KMS) | **SAFE** |
| Restore **new** encrypted instance (parallel) | **SAFE** (no prod pointer change) |
| One-off Fargate validation in existing private subnets/SG | **SAFE** (no SG/VPC rule changes) |
| Update Secrets Manager `DATABASE_URL` | **REQUIRES APPROVAL** — **not executed** |
| ECS service cutover / new task def for prod DB | **REQUIRES APPROVAL** — **not executed** |
| Delete `malcon-nexus-pg` or snapshots | **UNSAFE / PROHIBITED** — not executed |
| JWT rotation, WAF, TLS, SG/VPC/ECS network changes | **UNSAFE / PROHIBITED** — not executed |
| Backup retention → 7 days | **PROHIBITED** (Free Tier) — not attempted |
| Deletion protection / Multi-AZ changes on clone or source | **PROHIBITED** — not attempted |
| Enable ECS Exec on production service | **REQUIRES APPROVAL** — not used; one-off task used instead |

## Posture check (after build)

| Control | Expected | Observed |
|---------|----------|----------|
| Production on `malcon-nexus-pg` | yes | yes — `/health/db` 200, 46 employees |
| ECS task def | `:5`, secrets[] | unchanged |
| Secrets Manager values | unchanged version in use | no new version written |
| RDS clone encrypted | yes | `StorageEncrypted=true`, KMS `alias/aws/rds` |
| Clone publicly accessible | false | false |
| Source deletion protection | true | true |

## Recommendation

**Proceed to cutover only after human approval** using `agent-4-cutover-rollback.md`. Until then, treat `malcon-nexus-db-encrypted` as confidential same as production (snapshot-derived credentials).
