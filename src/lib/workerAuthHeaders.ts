import { supabase } from './supabase';

/** Attach Supabase session access token for Worker API calls (never send employee id/role). */
export async function getWorkerAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
