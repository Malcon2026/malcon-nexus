/**
 * Phase 8 — opt-in local Worker reads (default off; Supabase remains default).
 */
export const USE_WORKER_READS = import.meta.env.VITE_USE_WORKER_READS === 'true';

/** Phase 9.1 — notification reads only (default off). */
export const USE_WORKER_NOTIFICATION_READS =
  import.meta.env.VITE_USE_WORKER_NOTIFICATION_READS === 'true';

/** Phase 9.2 — hospitals, doctors, departments, kits, app_settings reads (default off). */
export const USE_WORKER_REFERENCE_READS =
  import.meta.env.VITE_USE_WORKER_REFERENCE_READS === 'true';

/** Phase 9.3 — attendance + operational reads (default off). */
export const USE_WORKER_OPERATIONS_READS =
  import.meta.env.VITE_USE_WORKER_OPERATIONS_READS === 'true';

/** Phase 9.4 — approvals, activity, case-task reads + server-side case scope (default off). */
export const USE_WORKER_REMAINING_READS =
  import.meta.env.VITE_USE_WORKER_REMAINING_READS === 'true';

export const WORKER_API_URL =
  (import.meta.env.VITE_WORKER_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8787';

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
