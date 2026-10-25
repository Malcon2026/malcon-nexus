# Agent 4 — Cutover & rollback (Phase 4D-2)

## Current state (after build, before cutover)

| Role | Instance | Encrypted | In Secrets Manager / ECS |
|------|----------|-----------|-------------------------|
| **Production** | `malcon-nexus-pg` | no | yes (`DATABASE_URL` → source endpoint) |
| **Clone (standby)** | `malcon-nexus-db-encrypted` | yes | **not wired** |

Snapshots retained:

- `malcon-nexus-pre-encryption-20261018-1139` (unencrypted)
- `malcon-nexus-pre-encryption-20261018-1139-enc` (encrypted)

## Cutover plan (REQUIRES EXPLICIT APPROVAL)

**Preconditions**

- Clone validated (config + counts + private connectivity) — **done in 4D-2**
- Maintenance window communicated
- Rollback owner identified

**Steps**

1. **Pre-cutover snapshot** of clone (optional safety) or rely on existing encrypted snapshot.
2. **Secrets Manager:** new secret version for `malcon-nexus/api-env` with `DATABASE_URL` host updated to  
   `malcon-nexus-db-encrypted.cpumo6uq2a4o.ap-south-1.rds.amazonaws.com` (same user, db `malconnexus`, TLS behavior unchanged).  
   **Do not** rotate password or JWT in same change.
3. **ECS:** `force-new-deployment` on service `malcon-nexus-api` (task def `:5` unchanged; execution role pulls new secret version).
4. **Validate:** API Gateway `GET /health`, `GET /health/db`, auth smoke (401 on protected routes).
5. **Monitor:** 24–48h error rates; keep `malcon-nexus-pg` running read-only idle until decommission approved.

**Not in cutover:** rename-in-place, delete old RDS, SG changes, backup retention experiments, 7-day backup retry.

## Rollback (after cutover)

1. Revert Secrets Manager `DATABASE_URL` to **previous version** (`AWSPREVIOUS` metadata: `2b2654bb-44f6-47eb-b011-ec0e7212ee38`) or documented pre-cutover version id.
2. Force ECS redeploy on `:5`.
3. Confirm `/health/db` and employee count match expectations.
4. Clone `malcon-nexus-db-encrypted` may remain for forensics; do not delete without approval.

## Rollback (if cutover never happened)

- **No action required** — production never left `malcon-nexus-pg`.
- Optional: delete clone instance and snapshots only with explicit approval (deletion protection on source remains **true**).

## Blockers

- **Approval gate:** this prompt did **not** authorize SM or ECS cutover.
