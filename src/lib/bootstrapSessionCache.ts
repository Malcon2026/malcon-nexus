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

function readRawFrom(store: Storage, employeeId: string): BootstrapCachePayload | null {
  try {
    const raw = store.getItem(bootstrapCacheKey(employeeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootstrapCachePayload;
    if (parsed?.data && typeof parsed.savedAt === 'number') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function readRaw(employeeId: string): BootstrapCachePayload | null {
  if (typeof window === 'undefined') return null;
  return (
    readRawFrom(sessionStorage, employeeId) ?? readRawFrom(localStorage, employeeId)
  );
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

function seedPayload(payload: BootstrapCachePayload): void {
  if (!supabaseStorage) return;
  for (const [key, value] of Object.entries(payload.data)) {
    supabaseStorage.seedCache(key, value);
  }
}

/** Fast path: sessionStorage only (same tab) — avoids parsing a huge localStorage blob on startup. */
export function restoreBootstrapCacheForDisplay(employeeId: string): boolean {
  if (!supabaseStorage || typeof sessionStorage === 'undefined') return false;
  const parsed = readRawFrom(sessionStorage, employeeId);
  if (!parsed) return false;
  if (Date.now() - parsed.savedAt > DISPLAY_MAX_AGE_MS) return false;
  if (!cachePayloadHasUsableData(parsed)) return false;
  seedPayload(parsed);
  return true;
}

/** After first paint: restore from localStorage if session cache was empty (new tab / browser restart). */
export function restoreBootstrapCacheFromLocalAsync(employeeId: string): Promise<boolean> {
  if (typeof localStorage === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const run = () => {
      const parsed = readRawFrom(localStorage, employeeId);
      if (!parsed || Date.now() - parsed.savedAt > DISPLAY_MAX_AGE_MS) {
        resolve(false);
        return;
      }
      if (!cachePayloadHasUsableData(parsed)) {
        resolve(false);
        return;
      }
      seedPayload(parsed);
      resolve(true);
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 120 });
    } else {
      setTimeout(run, 0);
    }
  });
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
  const writeLocal = () => {
    try {
      localStorage.setItem(key, json);
    } catch {
      /* quota — cases payload can be large */
    }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(writeLocal, { timeout: 3000 });
  } else {
    setTimeout(writeLocal, 0);
  }
}
