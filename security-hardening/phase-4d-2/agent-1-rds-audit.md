# Agent 1 — Live RDS audit (Phase 4D-2)

**Account:** 353728888679 · **Region:** ap-south-1 · **Captured:** 2026-10-18 (IST)

## Source instance: `malcon-nexus-pg`

| Attribute | Value |
|-----------|--------|
| Status | `available` |
| Engine | PostgreSQL **16.15** |
| Class | `db.t4g.micro` |
| Storage | 20 GiB **gp3** |
| **StorageEncrypted** | **`false`** → migration required |
| PubliclyAccessible | `false` |
| Multi-AZ | `false` |
| BackupRetentionPeriod | **1** (Phase 4D-1; 7-day deferred) |
| DeletionProtection | **true** (Phase 4D-1) |
| VPC | `vpc-009ee853ac9c17d92` |
| DB subnet group | `default` (3 subnets, ap-south-1a/b/c) |
| VPC security group | `sg-078ca764ce05bc9c5` |
| Master username | `malcon_admin` (password not recorded) |
| Endpoint | `malcon-nexus-pg.cpumo6uq2a4o.ap-south-1.rds.amazonaws.com:5432` |
| DBName (create param) | unset (app DB `malconnexus` created separately) |
| ARN | `arn:aws:rds:ap-south-1:353728888679:db:malcon-nexus-pg` |

## Reconciliation

- **StorageEncrypted=false** — Phase 4D-2 build path **proceeds** (not BLOCKED).
- Original instance **unchanged** as production target; clone created separately.

## Artifacts

- `pre-change/rds.json` — full `describe-db-instances` (no credentials)
