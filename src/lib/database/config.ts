import { supabaseStorage } from './storage';

export const USE_SUPABASE =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

/** Update in-memory cache without triggering broken generic Supabase upsert. */
export function setCache<T>(key: string, data: T[]): void {
  if (USE_SUPABASE && supabaseStorage) {
    supabaseStorage.seedCache(key, data);
    return;
  }
  // Local mode: fall through to Database.saveAll via repositories
}

export function newId(): string {
  return crypto.randomUUID();
}
