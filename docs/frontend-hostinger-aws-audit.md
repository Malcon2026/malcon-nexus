# Frontend → Hostinger + AWS API (read-only audit)

**Date:** 2026-10-18  
**Target API:** `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com`  
**Production SPA URL:** `https://app.malconnexus.com/`  
**No code or AWS changes in this audit.**

---

## A. Current frontend → backend flow

- **Build/deploy modes** (`scripts/deploy-hostinger-app.mjs`): default `deploy:hostinger` = Supabase; **`deploy:hostinger:aws`** + `.env.production.aws` = `VITE_USE_AWS_BACKEND=true` + `VITE_WORKER_API_URL`.
- **API base:** `src/lib/workerReadConfig.ts` — `VITE_WORKER_API_URL` or `VITE_API_BASE_URL`; fallback **`http://127.0.0.1:8787`** if unset.
- **HTTP:** `src/lib/workerApi.ts` → `${WORKER_API_URL}/api/...`
- **AWS mode:** `src/lib/cloudflareConfig.ts` — `VITE_USE_AWS_BACKEND` forces remote reads/writes via Worker adapters (same paths as API Gateway).
- **Auth (AWS):** `workerAuthClient` + `localStorage` `malcon_nexus_access_token`; Bearer on API calls.
- **Supabase stubbed** when cloud/AWS backend flag on (`src/lib/supabase.ts`).
- **Still Supabase-dependent features:** gallery, TV board, some integrations (see F).

---

## B. Localhost references (production-relevant)

| Location | Note |
|----------|------|
| `src/lib/workerReadConfig.ts` | Default API `127.0.0.1:8787` |
| `src/dev/*Harness.ts` | Dev only |
| `worker/wrangler.toml` | Dev CORS `localhost:5173` |

Scripts under `scripts/` use localhost for local tests only (not in Hostinger bundle).

---

## C. Required production env (AWS + Hostinger build)

| Variable | Required value |
|----------|----------------|
| `VITE_USE_AWS_BACKEND` | `true` |
| `VITE_USE_CLOUDFLARE_BACKEND` | `false` |
| `VITE_WORKER_API_URL` or `VITE_API_BASE_URL` | API Gateway URL (no trailing slash) |

Optional: `VITE_ATTENDANCE_SELFIE_ONLY`, `VITE_SUPER_ADMIN_EMAILS`, `VITE_FORCE_ADVANCE_PASSWORD` (see risks).

Server CORS on AWS API must include `https://app.malconnexus.com`.

---

## D. Files likely needing changes (future deploy phase)

1. Gitignored `.env.production.aws` (from `.env.production.aws.example`)
2. Docs: `share/hostinger-app-deploy.md`, `CURSOR_HANDOVER.md`
3. Gallery/TV Supabase function paths if AWS-only
4. Optional: guard/remove `127.0.0.1:8787` fallback for production builds
5. Review `VITE_FORCE_ADVANCE_PASSWORD` client exposure

---

## E. Hostinger requirements

- Build with correct `VITE_*` then `deploy:hostinger:aws`
- `public/.htaccess` → SPA + `/gallery`, `/tv` entries
- Main app: tab navigation (limited deep links); gallery/TV use React Router

---

## F. Risks / blockers

| Risk | Severity |
|------|----------|
| Missing `VITE_WORKER_API_URL` on build | Critical (browser hits 127.0.0.1:8787) |
| Default `deploy:hostinger` = Supabase | High |
| Gallery/TV still Supabase functions | High on AWS-only |
| CORS misconfiguration | High |
| `VITE_FORCE_ADVANCE_PASSWORD` in bundle | High (review) |
| Integrations disabled on AWS path | Medium |

---

Source: parallel read-only audit (Phase frontend prep).
