import { USE_MANAGED_API_BACKEND } from '../cloudflareConfig';
import { supabaseStorage } from './storage';

export const USE_SUPABASE =
  !USE_MANAGED_API_BACKEND &&
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

/** Worker/D1 or Supabase — not offline localStorage-only demo mode. */
export const REMOTE_DATA = USE_SUPABASE || USE_MANAGED_API_BACKEND;

/** Update session cache (Supabase + Cloudflare Worker bootstrap store). */
export function setCache<T>(key: string, data: T[]): void {
  if (REMOTE_DATA && supabaseStorage) {
    supabaseStorage.seedCache(key, data);
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
