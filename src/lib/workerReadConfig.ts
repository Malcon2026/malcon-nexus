import { USE_CONVEX_BACKEND, USE_REMOTE_API } from './cloudflareConfig';

/**
 * Phase 8 — opt-in local Worker reads (default off; Supabase remains default).
 */
export const USE_WORKER_READS =
  USE_REMOTE_API || import.meta.env.VITE_USE_WORKER_READS === 'true';

/** Phase 9.1 — notification reads only (default off). */
export const USE_WORKER_NOTIFICATION_READS =
  USE_REMOTE_API || import.meta.env.VITE_USE_WORKER_NOTIFICATION_READS === 'true';

/** Phase 9.2 — hospitals, doctors, departments, kits, app_settings reads (default off). */
export const USE_WORKER_REFERENCE_READS =
  USE_REMOTE_API || import.meta.env.VITE_USE_WORKER_REFERENCE_READS === 'true';

/** Phase 9.3 — attendance + operational reads (default off). */
export const USE_WORKER_OPERATIONS_READS =
  USE_REMOTE_API || import.meta.env.VITE_USE_WORKER_OPERATIONS_READS === 'true';

/** Phase 9.4 — approvals, activity, case-task reads + server-side case scope (default off). */
export const USE_WORKER_REMAINING_READS =
  USE_REMOTE_API || import.meta.env.VITE_USE_WORKER_REMAINING_READS === 'true';

function resolveWorkerApiUrl(): string {
  if (USE_CONVEX_BACKEND) {
    const convexSite =
      (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined)?.replace(/\/+$/, '') ||
      (import.meta.env.VITE_WORKER_API_URL as string | undefined)?.replace(/\/+$/, '');
    if (convexSite) return convexSite;
    if (import.meta.env.PROD) {
      throw new Error('Production Convex build requires VITE_CONVEX_SITE_URL (HTTP actions URL).');
    }
  }

  const raw =
    (import.meta.env.VITE_WORKER_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined);
  const trimmed = raw?.replace(/\/+$/, '');
  if (trimmed) return trimmed;

  const remoteProd =
    import.meta.env.PROD &&
    (import.meta.env.VITE_USE_AWS_BACKEND === 'true' ||
      import.meta.env.VITE_USE_CLOUDFLARE_BACKEND === 'true' ||
      USE_CONVEX_BACKEND);
  if (remoteProd) {
    throw new Error(
      'Production build requires VITE_CONVEX_SITE_URL or VITE_WORKER_API_URL for remote API.',
    );
  }
  return 'http://127.0.0.1:8787';
}

/** AWS / Worker API base (no trailing slash). `VITE_API_BASE_URL` is an alias. */
export const WORKER_API_URL = resolveWorkerApiUrl();

export function useWorkerReads(): boolean {
  return USE_WORKER_READS;
}

export function useWorkerNotificationReads(): boolean {
  return USE_WORKER_NOTIFICATION_READS;
}

export function useWorkerReferenceReads(): boolean {
  return USE_WORKER_REFERENCE_READS;
}

export function useWorkerOperationsReads(): boolean {
  return USE_WORKER_OPERATIONS_READS;
}

export function useWorkerRemainingReads(): boolean {
  return USE_WORKER_REMAINING_READS;
}

/** Server-filtered employee case lists (requires Phase 8 reads + 9.4). */
export function useWorkerCaseScopeReads(): boolean {
  return USE_WORKER_READS && USE_WORKER_REMAINING_READS;
}
