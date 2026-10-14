import { WORKER_API_URL } from './workerReadConfig';
import { getWorkerAuthHeaders } from './workerAuthHeaders';

type AuthErrorBody = { error?: { message?: string } };

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const url = `${WORKER_API_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & AuthErrorBody;
  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    return { error: msg };
  }
  return { data: json };
}

export type WorkerAuthEmployee = {
  id: string;
  role: string;
  name: string;
  email: string | null;
};

export async function workerLogin(email: string, password: string) {
  return postJson<{ access_token: string; employee: WorkerAuthEmployee }>('/api/auth/login', {
    email,
    password,
  });
}

export async function workerRequestOtp(employeeCode: string) {
  const trimmed = employeeCode.trim().replace(/^#+\s*/, '').trim();
  return postJson<{ ok?: boolean; message?: string }>('/api/auth/request-otp', { employeeCode: trimmed });
}

export async function workerVerifyOtp(employeeCode: string, otp: string) {
  return postJson<{ access_token: string; employee: WorkerAuthEmployee }>('/api/auth/verify-otp', {
    employeeCode,
    otp,
  });
}

export async function workerFetchMe(): Promise<{ data?: { employee: Record<string, unknown> }; error?: string }> {
  const url = `${WORKER_API_URL}/api/auth/me`;
  const headers = await getWorkerAuthHeaders();
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
  const json = (await res.json().catch(() => ({}))) as AuthErrorBody & { employee?: Record<string, unknown> };
  if (!res.ok) return { error: json?.error?.message ?? `Request failed (${res.status})` };
  return { data: { employee: json.employee ?? {} } };
}
