/**
 * Remote data: Convex (preferred) or legacy Cloudflare Worker / AWS API.
 * Supabase Auth only when Convex is on — no Supabase Postgres data plane.
 */
export const USE_CONVEX_BACKEND = import.meta.env.VITE_USE_CONVEX_BACKEND === 'true';

/** Legacy AWS API — not used on Hostinger default deploy. */
export const USE_AWS_BACKEND =
  !USE_CONVEX_BACKEND && import.meta.env.VITE_USE_AWS_BACKEND === 'true';

/** Cloudflare Worker + D1 (legacy cutover). */
export const USE_CLOUDFLARE_WORKER_BACKEND =
  !USE_CONVEX_BACKEND && import.meta.env.VITE_USE_CLOUDFLARE_BACKEND === 'true';

/** Worker-native login (Malcon JWT), not Supabase session. */
export const USE_WORKER_NATIVE_AUTH =
  USE_AWS_BACKEND || USE_CLOUDFLARE_WORKER_BACKEND;

/** SPA reads/writes via remote HTTP API (Convex site or Worker). */
export const USE_REMOTE_API =
  USE_CONVEX_BACKEND || USE_CLOUDFLARE_WORKER_BACKEND || USE_AWS_BACKEND;

/** @deprecated alias — same as USE_REMOTE_API for repository switches. */
export const USE_CLOUDFLARE_BACKEND = USE_REMOTE_API;
