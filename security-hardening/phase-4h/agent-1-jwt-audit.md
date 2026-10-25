# Agent 1 — JWT implementation audit

## Verification path

- `worker/src/lib/jwt.ts` — HS256 Web Crypto verify/sign; audience default `authenticated`.
- `worker/src/middleware/auth.ts` — Bearer → verify → `lookupEmployeeForAuth(sub)` → `ctx.employeeId` / `ctx.role` from DB only.
- `worker/src/services/cloudflareAuth.ts` — Malcon login/OTP issues tokens via `signAccessToken`; `sub` = `auth_user_id` or employee UUID.
- `aws-api` — `assertProductionSecurityConfig()` at startup (`worker/src/lib/productionSecurity.ts`).

## Production metadata (pre-4H)

| Key | Length (chars) | Notes |
|-----|----------------|--------|
| `JWT_SECRET` | 27 | Below 32-char policy |
| `SUPABASE_JWT_SECRET` | 27 | Same value as `JWT_SECRET` |
| `ENVIRONMENT` | 10 | `production` |

## Gaps addressed in 4H

- Dual-secret verification (comma-separated primary + previous segment).
- Primary segment min length 32 enforced at startup after rotation.
- Signing uses primary segment only (`jwtSigningSecret`).

## Secret handling

No secret values recorded in this artifact.
