/**
 * Remote Malcon API (Cloudflare Worker or AWS). Supabase data plane is off when this is on.
 */
export const USE_AWS_BACKEND = import.meta.env.VITE_USE_AWS_BACKEND === 'true';

/** True when the SPA uses Worker or AWS API routes (same client code paths). */
export const USE_CLOUDFLARE_BACKEND =
  import.meta.env.VITE_USE_CLOUDFLARE_BACKEND === 'true' || USE_AWS_BACKEND;

export const USE_REMOTE_API = USE_CLOUDFLARE_BACKEND;
