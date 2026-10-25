# Agent 2 — JWT rotation plan

## Chosen approach: comma-separated dual secret

- **Primary:** new `>=32` char segment (signing + first verify key).
- **Secondary:** prior secret appended after comma (verify-only during 8h access-token TTL).
- Both `JWT_SECRET` and `SUPABASE_JWT_SECRET` set to the same combined value in SM merge.

## Alternative not used

- Separate `JWT_SECRET_PREVIOUS` SM key (supported in code + optional ECS inject) — skipped to avoid task-def change mid-rotation; can migrate later.

## Rollback (JWT-only)

| Stage | Version ID | Notes |
|-------|------------|--------|
| Pre-rotation AWSCURRENT | `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` | 27-char single secret |
| Post-rotation AWSCURRENT | `b9e73e2a-d21d-4b0c-9b19-ae475eb35513` | 43-char primary + legacy tail |
| AWSPREVIOUS after rotation | `6cc4ffda-d773-4db6-9ed5-f4a2f4a453ff` | Restore via `UpdateSecretVersionStage` or merge put |

**DB cutover-era version** `172df240-0daa-456f-aa0b-e219618d0186` — do **not** use for JWT rollback (DATABASE_URL era).

## Deferred cleanup

After one full token TTL (~8h), remove legacy segment from SM JSON (single 43-char primary only).
