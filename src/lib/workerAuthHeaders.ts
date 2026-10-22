import { USE_WORKER_NATIVE_AUTH } from './cloudflareConfig';
import { getAccessToken } from './malconSession';
import { supabase } from './supabase';

const SESSION_READ_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Check your connection and try again.`));
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Attach session access token for remote API calls (never send employee id/role). */
export async function getWorkerAuthHeaders(accessToken?: string): Promise<Record<string, string>> {
  if (accessToken) return { Authorization: `Bearer ${accessToken}` };
  if (USE_WORKER_NATIVE_AUTH) {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  const { data } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_READ_TIMEOUT_MS,
    'Reading auth session',
  );
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
