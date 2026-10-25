# Agent 4 — Frontend session / token storage

## Token storage

- Supabase client (`src/lib/supabase.ts`) uses **`localStorage`** for session persistence.
- Worker/Malcon password+OTP login returns `access_token`; app uses `workerFetchJson` with Bearer from active session.

## Risk notes

- localStorage is XSS-exposed; mitigations are CSP, dependency hygiene, and short TTL (8h access tokens).
- Bootstrap caches (`bootstrapSessionCache.ts`) use sessionStorage + localStorage for non-auth app data only.

## 4H scope

No frontend storage change (out of scope); API authZ hardening assumes bearer tokens may be present in browser storage.
