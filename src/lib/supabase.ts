import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { USE_WORKER_NATIVE_AUTH } from './cloudflareConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Convex (and legacy Supabase Postgres) use Supabase Auth; Worker/AWS use Malcon JWT only. */
const USE_SUPABASE_AUTH = !USE_WORKER_NATIVE_AUTH;

if (USE_SUPABASE_AUTH && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.\n' +
    'Get these from: https://supabase.com/dashboard → Project → Settings → API'
  );
}

export const supabase = USE_SUPABASE_AUTH
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
})
  : (null as unknown as ReturnType<typeof createClient<Database>>);
