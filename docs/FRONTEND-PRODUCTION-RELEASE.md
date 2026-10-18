# Frontend production release (Hostinger + AWS API)

**Date:** 2026-10-18  
**SPA:** https://app.malconnexus.com  
**API:** https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com  
**Classification:** **PRODUCTION READY WITH DEFERRED**

## Pre-flight

| Check | Status |
|-------|--------|
| `.env.production.aws` (gitignored) with AWS flags + API URL | Ready |
| Deploy script `deploy:hostinger:aws` | Ready |
| Secrets Manager `API_CORS_ORIGIN` | `https://app.malconnexus.com` (no change) |
| ECS redeploy for CORS | Not required |

## Implemented

- **`workerReadConfig.ts`:** Production AWS/Cloudflare builds throw if `VITE_WORKER_API_URL` is missing; dev keeps `127.0.0.1:8787` fallback.
- **`.env.production.aws.example`:** Documents real API Gateway URL; no `VITE_FORCE_ADVANCE_PASSWORD` on AWS.
- **`forceAdvanceAuth.ts`:** AWS production uses admin JWT + role only (no client secret in bundle).
- **Gallery / TV token feeds:** Disabled with clear UI when `VITE_USE_AWS_BACKEND=true` (no Supabase Edge on AWS path).
- **Integrations:** Existing `cloudflareIntegrations.ts` gates (email, webPush, Mappls, bike route) unchanged.

## Deferred

| Item | Notes |
|------|--------|
| Gallery `/gallery?token=…` | Needs Worker/AWS port of `gallery-feed` Edge Function |
| TV kiosk `/tv?token=…` | Same |
| Force advance server-side password | No API endpoint; mitigated by admin-only + no bundled secret on AWS |
| Supabase-only integrations | Documented in-app skip reasons |

## Build & deploy

```bash
npm run deploy:hostinger:aws
```

Build verified: no `127.0.0.1:8787` in `dist/`; API URL embedded; no force-advance password in bundle.

## Live checks

- API `GET /health` → 200
- Local `dist/` serve → SPA loads; bundle targets API Gateway URL
