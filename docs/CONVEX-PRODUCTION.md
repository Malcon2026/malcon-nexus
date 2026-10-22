# Convex production path (Hostinger)

Malcon Nexus production uses **Convex** for operational data and **Supabase Auth only** for sign-in.

## One-time setup

1. Convex project: `malcon-backend` / `malcon-nexus-ba4ec` (dev deployment provisioned via `npx convex dev --configure`).
2. Copy `.env.production.convex.example` → `.env.production.convex` and set:
   - `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` from Convex dashboard
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
3. Convex **production** env (`npx convex env set --prod NAME value` or Dashboard):
   - `SUPABASE_URL` — e.g. `https://ipometuqzcvdqeyvhcgg.supabase.co` (**required** for ES256 user sessions via JWKS)
   - `SUPABASE_JWT_SECRET` — optional HS256 legacy tokens (anon/service_role JWT)
   - `SUPABASE_JWT_AUD=authenticated`
   - `CONVEX_MIGRATION_KEY` — matches local value used by `npm run migrate:convex`
   - `API_CORS_ORIGIN=https://app.malconnexus.com`
4. Import data to **prod**:  
   `VITE_CONVEX_URL=https://fleet-dinosaur-954.convex.cloud CONVEX_MIGRATION_KEY=local-dev-migrate npm run migrate:convex`
5. Deploy SPA: `npm run deploy:hostinger` (uses `--convex` by default; needs `.env.production.convex` with real Supabase keys)

## AWS / Worker legacy

- `npm run deploy:hostinger:aws` — deprecated
- `npm run deploy:hostinger:cutover` — Cloudflare Worker + D1 (legacy)
- `aws-api/`, `scripts/aws/` — kept for reference; not on default deploy path

## Photos / Google Drive

Photo URLs and storage behavior from the D1 export are preserved in row data. Google Drive integration remains deferred.
