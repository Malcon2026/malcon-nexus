# Agent 2 — Encryption migration design (Phase 4D-2)

## Constraint

RDS PostgreSQL **cannot** enable encryption on an existing unencrypted volume in place. Standard AWS path: **snapshot → encrypted copy → restore new instance**.

## Source configuration (actual)

| Item | Value |
|------|--------|
| Instance | `malcon-nexus-pg` |
| Encryption | off |
| Engine | postgres 16.15 |
| Class | db.t4g.micro |
| Storage | gp3, 20 GiB |
| Network | private; SG `sg-078ca764ce05bc9c5`; subnet group `default` |

## Planned / executed build (no cutover)

### Phase 2 — Manual snapshot

- **ID:** `malcon-nexus-pre-encryption-20261018-1139`
- Source: `malcon-nexus-pg`
- Wait until `available`

### Phase 3 — Encrypted snapshot copy

- **ID:** `malcon-nexus-pre-encryption-20261018-1139-enc`
- **KMS:** AWS managed **`alias/aws/rds`** (`09c0c587-6af6-47c2-a271-21b2d1d03bcb`)
- No customer CMK required; no approval gate for KMS

### Phase 4 — Restore **new** instance

- **ID:** `malcon-nexus-db-encrypted`
- From encrypted snapshot; **does not replace** `malcon-nexus-pg`
- Restore params matched production: same class, subnet group, SG, `--no-publicly-accessible`
- **StorageEncrypted:** `true` on create (from snapshot)

### Phase 5 — Validation (pre-cutover)

- Config: `describe-db-instances` on clone
- Connectivity: one-off Fargate task in **same private subnets/SG** as API (`malcon-nexus-api:5`)
- Data parity: row counts on `employees`, `cases`, `hospitals`, `attendance_records` in DB `malconnexus` — source vs clone

## Explicitly out of scope (this phase)

- Updating Secrets Manager `DATABASE_URL`
- ECS service / task definition changes for cutover
- Deleting `malcon-nexus-pg` or any snapshot
- Backup retention, deletion protection, Multi-AZ, SG/VPC, JWT/WAF/TLS

## Post-cutover (approval only)

1. Update `malcon-nexus/api-env` `DATABASE_URL` host to clone endpoint (same user/password/db/ssl).
2. Force new ECS deployment on `:5` (secrets refresh).
3. Validate `/health/db` via API Gateway; optional rename/swap strategy in a later approved window.
4. Retire old instance only after explicit approval and backup policy review.
