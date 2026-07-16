import { supabase } from '../supabase';

export interface StorageProvider {
  getItem<T>(key: string): T | null;
  setItem<T>(key: string, value: T): void;
  removeItem(key: string): void;
  clear(): void;
}

// ──────────────────────────────────────────────────────────────
// LocalStorageProvider — used during development / offline mode
// ──────────────────────────────────────────────────────────────
export class LocalStorageProvider implements StorageProvider {
  getItem<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(`Error reading from localStorage key "${key}":`, e);
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error writing to localStorage key "${key}":`, e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error removing localStorage key "${key}":`, e);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// TABLE NAME MAP
// Maps the localStorage collection keys used throughout the
// codebase to their actual Supabase table names.
// ──────────────────────────────────────────────────────────────
const TABLE_MAP: Record<string, string> = {
  employees:   'employees',
  hospitals:   'hospitals',
  doctors:     'doctors',
  departments: 'departments',
  kits:        'surgical_kits',
  cases:       'cases',
  notifications: 'notifications',
  approvals:   'approvals',
  activityLog: 'activity_log',
  attendanceRecords: 'attendance_records',
};

// ──────────────────────────────────────────────────────────────
// COLUMN NAME MAP
// Maps camelCase TypeScript field names → snake_case Supabase columns
// (only needed for top-level fields, JSONB children keep their shape)
// ──────────────────────────────────────────────────────────────
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const camelToSnake = (str: string) =>
    str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [camelToSnake(key), value])
  );
}

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const snakeToCamel = (str: string) =>
    str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [snakeToCamel(key), value])
  );
}

// ──────────────────────────────────────────────────────────────
// SupabaseStorageProvider
// Implements the same StorageProvider interface but persists to
// Supabase instead of localStorage.
//
// NOTE: Because the existing Database.getAll() / Database.saveAll()
// calls are synchronous but Supabase is async, this provider uses
// a synchronous in-memory cache that is populated on first access
// via a separate async bootstrap in the repositories.
// ──────────────────────────────────────────────────────────────
export class SupabaseStorageProvider implements StorageProvider {
  private cache: Map<string, unknown[]> = new Map();

  getItem<T>(key: string): T | null {
    // Returns from in-memory cache (populated by async bootstrap)
    const cached = this.cache.get(key);
    return (cached as T) ?? null;
  }

  setItem<T>(key: string, value: T): void {
    // Update in-memory cache immediately (optimistic)
    this.cache.set(key, value as unknown[]);

    // Fire-and-forget async persist to Supabase
    this._persist(key, value as unknown[]).catch((err) =>
      console.error(`[Supabase] Failed to persist "${key}":`, err)
    );
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    // For collections we clear the table (handled case-by-case in Database.clearAll)
  }

  clear(): void {
    this.cache.clear();
  }

  /** Populate cache from Supabase fetch — does not write back to DB */
  seedCache(key: string, data: unknown[]): void {
    this.cache.set(key, data);
  }

  /** Async bootstrap: fetch a collection from Supabase into the cache */
  async hydrate(key: string): Promise<void> {
    const table = TABLE_MAP[key];
    if (!table) return;

    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true });
    if (error) {
      console.error(`[Supabase] hydrate("${key}") error:`, error.message);
      return;
    }
    // Convert snake_case DB rows → camelCase app objects
    const mapped = (data ?? []).map((row) => toCamelCase(row as Record<string, unknown>));
    this.cache.set(key, mapped);
  }

  private async _persist(key: string, data: unknown[]): Promise<void> {
    const table = TABLE_MAP[key];
    if (!table) return;

    // Collections with dedicated Supabase repositories (correct column mapping)
    if (['cases', 'approvals', 'notifications', 'activityLog', 'attendanceRecords', 'employees', 'hospitals', 'doctors'].includes(key)) return;

    // Convert camelCase app objects → snake_case DB columns
    const rows = data.map((item) => toSnakeCase(item as Record<string, unknown>));

    // Upsert all rows (insert or update by primary key)
    const { error } = await supabase.from(table).upsert(rows as never[], { onConflict: 'id' });
    if (error) {
      throw new Error(`[Supabase] upsert to "${table}" failed: ${error.message}`);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// ACTIVE PROVIDER — switch between localStorage and Supabase
// Set to SupabaseStorageProvider() once your .env is configured
// ──────────────────────────────────────────────────────────────
const USE_SUPABASE = import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

export const storage: StorageProvider = USE_SUPABASE
  ? new SupabaseStorageProvider()
  : new LocalStorageProvider();

export const supabaseStorage = USE_SUPABASE
  ? (storage as SupabaseStorageProvider)
  : null;
