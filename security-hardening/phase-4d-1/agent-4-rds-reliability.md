# Agent 4 — RDS reliability analysis

**Instance:** `malcon-nexus-pg` (PostgreSQL 16.15, `db.t4g.micro`)

## Pre-change state

| Setting | Value |
|---------|--------|
| BackupRetentionPeriod | **0** (no automated backups) |
| DeletionProtection | **false** |
| MultiAZ | **false** |
| StorageEncrypted | false (out of scope 4D-1) |
| PubliclyAccessible | false |

## Safe in-place changes (4D-1)

### Backup retention ≥ 7 days

- **API:** `modify-db-instance --backup-retention-period 7`
- **Risk:** Low; enables automated snapshots; small storage cost for backup storage.
- **Downtime:** None expected for retention increase from 0.
- **Account constraint (applied in 4D-1):** `FreeTierRestrictionError` for retention **> 1** day. Applied **1 day** (maximum allowed without plan upgrade). **7 days deferred** until account plan upgrade.

### Deletion protection = true

- **API:** `modify-db-instance --deletion-protection`
- **Risk:** Low; prevents accidental `DeleteDBInstance`.
- **Downtime:** None.

**Order:** Apply backup retention first, wait until `available`, then enable deletion protection, verify again.

## Multi-AZ

- **ModifyDBInstance `MultiAZ=true`** on PostgreSQL is an **in-place modification** (no instance replacement / new endpoint in typical cases).
- **Caveat:** Enabling Multi-AZ can cause a **brief failover / connectivity blip** while standby is created (often seconds to ~1 minute).
- AWS CLI has **no `--dry-run`** for `modify-db-instance`.
- **4D-1 decision:** **DEFER** Multi-AZ to a scheduled maintenance window; apply backup + deletion protection now.

## Post-change validation

- ECS still on `:5`, `GET /health/db` returns 200.
- Re-describe RDS: retention ≥ 7, deletion protection true, status `available`.
