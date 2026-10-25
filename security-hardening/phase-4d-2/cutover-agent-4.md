# Cutover Agent 4 — Execution & rollback (Phase 4D-2 cutover)

## Authorization

Explicit user approval received in coordinator prompt for production cutover.

## Executed steps

| Step | Action | Outcome |
|------|--------|---------|
| 0 | Re-verify RDS, ECS, SM host, snapshots | **PASS** |
| 1 | Update `DATABASE_URL` host only in `malcon-nexus/api-env` | Version `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` |
| 2 | `aws ecs update-service --force-new-deployment` (`:5`) | Rollout **COMPLETED**, 1/1 |
| 3 | Health + auth matrix | **PASS** |

**Cutover timestamp (IST):** 2026-10-18T12:01:03+05:30 (ECS rollout completed; SM update immediately prior).

## Rollback procedure (if needed)

1. Restore `DATABASE_URL` to source host using Secrets Manager version **`172df240-0daa-456f-aa0b-e219618d0186`** (now **AWSPREVIOUS**) or put-secret-value reverting host to `malcon-nexus-pg.cpumo6uq2a4o.ap-south-1.rds.amazonaws.com` only.
2. Force ECS redeploy on **`malcon-nexus-api:5`**.
3. Validate `/health/db` and employee count **46**.
4. **Do not** delete `malcon-nexus-pg`, `malcon-nexus-db-encrypted`, or snapshots.

## Rollback status this run

**Not required** — cutover validation passed.
