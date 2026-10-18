# Delink Malcon Nexus from Supabase (production)

Production at **https://app.malconnexus.com** should use **only**:

- **Hostinger** — static SPA  
- **AWS API Gateway → ECS → RDS + S3** — data, auth, photos  

Supabase is **legacy** (local dev, cutover mode, or old deploys).

## What the repo enforces

| Layer | Supabase? |
|-------|-----------|
| `npm run deploy:hostinger:aws` | Strips `VITE_SUPABASE_*`, verifies `dist/` has no `supabase.co` |
| Runtime (`VITE_USE_AWS_BACKEND=true`) | `USE_SUPABASE` is false; data/auth via Worker API + Malcon JWT |
| Stage photos / selfies | S3 via `/api/storage/...` |
| Gallery / TV token feeds | `/api/gallery-feed` on AWS API (after API deploy + `GALLERY_TOKEN` in SM) |

## Deploy (required after code changes)

```bash
npm run deploy:hostinger:aws
```

## In Supabase Dashboard (manual)

1. **Confirm zero traffic** — Project → Reports / Logs: no REST or Storage hits from prod users for a few days.  
2. **Optional:** Project Settings → **Pause project** (stops egress billing; you can restore for export).  
3. **Do not delete** until RDS backups and S3 photo migration are verified.  
4. Old photo URLs in Postgres may still point at `*.supabase.co` until re-uploaded or migrated.

## AWS secrets note

`SUPABASE_JWT_SECRET` in `malcon-nexus/api-env` is a **legacy env name** for JWT verification on the API, not a live link to Supabase Auth for the SPA.

## Modes that still use Supabase (not production AWS)

- Default `npm run deploy:hostinger` (Supabase-only)  
- `deploy:hostinger:cutover` (Worker data + Supabase Auth)  
- Local dev with `VITE_SUPABASE_URL` in `.env.local`
