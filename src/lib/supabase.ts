import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (
  !USE_CLOUDFLARE_BACKEND &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.\n' +
    'Get these from: https://supabase.com/dashboard → Project → Settings → API'
  );
}

export const supabase = USE_CLOUDFLARE_BACKEND
  ? (null as unknown as ReturnType<typeof createClient<Database>>)
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
});
