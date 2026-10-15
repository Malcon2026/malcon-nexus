import { USE_MANAGED_API_BACKEND } from './cloudflareConfig';
import { getAccessToken } from './malconSession';
import { supabase } from './supabase';

/** Attach session access token for Worker API calls (never send employee id/role). */
export async function getWorkerAuthHeaders(): Promise<Record<string, string>> {
  if (USE_MANAGED_API_BACKEND) {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
