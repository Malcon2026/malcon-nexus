import { USE_WORKER_NATIVE_AUTH } from './cloudflareConfig';
import { getAccessToken } from './malconSession';
import { supabase } from './supabase';

/** Attach session access token for remote API calls (never send employee id/role). */
export async function getWorkerAuthHeaders(): Promise<Record<string, string>> {
  if (USE_WORKER_NATIVE_AUTH) {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
