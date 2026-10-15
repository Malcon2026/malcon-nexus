/**
 * Production API backend switches (mutually exclusive AWS vs Cloudflare).
 * When either is on, the SPA uses the Malcon HTTP API — not Supabase Postgres/Auth/Storage.
 */
export const USE_AWS_BACKEND = import.meta.env.VITE_USE_AWS_BACKEND === 'true';

export const USE_CLOUDFLARE_BACKEND =
  !USE_AWS_BACKEND && import.meta.env.VITE_USE_CLOUDFLARE_BACKEND === 'true';

/** AWS RDS API or Cloudflare Worker + D1. */
export const USE_MANAGED_API_BACKEND = USE_AWS_BACKEND || USE_CLOUDFLARE_BACKEND;
