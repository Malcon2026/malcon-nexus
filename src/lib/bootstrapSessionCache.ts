import { supabaseStorage } from './database/storage';

/** Must stay in sync with `bootstrap.ts` persist keys / version. */
export const BOOTSTRAP_CACHE_PREFIX = 'malcon-nexus-bootstrap-v13';

/** Skip network essential fetch when session cache is newer than this. */
export const BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;

/** Show last-known data from cache up to this age (localStorage survives tab close). */
const DISPLAY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface BootstrapCachePayload {
  savedAt: number;
  data: Record<string, unknown[]>;
}

export function bootstrapCacheKey(employeeId: string): string {
  return `${BOOTSTRAP_CACHE_PREFIX}:${employeeId}`;
}

function readRaw(employeeId: string): BootstrapCachePayload | null {
  if (typeof window === 'undefined') return null;
  const key = bootstrapCacheKey(employeeId);
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as BootstrapCachePayload;
      if (parsed?.data && typeof parsed.savedAt === 'number') return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function isBootstrapCacheFresh(
  employeeId: string,
  ttlMs: number = BOOTSTRAP_CACHE_TTL_MS,
): boolean {
  const parsed = readRaw(employeeId);
  if (!parsed?.savedAt) return false;
  return Date.now() - parsed.savedAt < ttlMs;
}

export function cachePayloadHasUsableData(payload: BootstrapCachePayload): boolean {
  const d = payload.data;
  if (Array.isArray(d.cases) && d.cases.length > 0) return true;
  if (Array.isArray(d.employees) && d.employees.length > 0) return true;
  if (Array.isArray(d.attendanceRecords) && d.attendanceRecords.length > 0) return true;
  return false;
}

/** Seed in-memory cache from session/local storage (may be slightly stale). */
export function restoreBootstrapCacheForDisplay(employeeId: string): boolean {
  if (!supabaseStorage) return false;
  const parsed = readRaw(employeeId);
  if (!parsed) return false;
  if (Date.now() - parsed.savedAt > DISPLAY_MAX_AGE_MS) return false;
  if (!cachePayloadHasUsableData(parsed)) return false;

  for (const [key, value] of Object.entries(parsed.data)) {
    supabaseStorage.seedCache(key, value);
  }
  return true;
}

export function writeBootstrapCachePayload(employeeId: string, payload: BootstrapCachePayload): void {
  if (typeof window === 'undefined') return;
  const key = bootstrapCacheKey(employeeId);
  const json = JSON.stringify(payload);
  try {
    sessionStorage.setItem(key, json);
  } catch {
    /* quota */
  }
  try {
    localStorage.setItem(key, json);
  } catch {
    /* quota — cases payload can be large */
  }
}
