import { WorkerApiError, workerFetchJson } from './workerApi';
import { WORKER_API_URL } from './workerReadConfig';
import { getWorkerAuthHeaders } from './workerAuthHeaders';

export type WorkerStorageBucket = 'stage-photos' | 'attendance-selfies' | 'hr-kyc-uploads';

export async function fetchWorkerStorageStatus(): Promise<Record<WorkerStorageBucket, boolean>> {
  const body = await workerFetchJson<{ data?: { buckets?: Record<WorkerStorageBucket, boolean> } }>(
    '/api/storage/status',
  );
  return body.data?.buckets ?? {
    'stage-photos': false,
    'attendance-selfies': false,
    'hr-kyc-uploads': false,
  };
}

export async function uploadViaWorkerStorage(
  bucket: WorkerStorageBucket,
  key: string,
  file: File | Blob,
  extraFields?: Record<string, string>,
): Promise<{ key: string; publicUrl: string | null }> {
  const form = new FormData();
  form.set('key', key);
  form.set('contentType', file instanceof File ? file.type || 'application/octet-stream' : 'application/octet-stream');
  form.set('file', file);
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) form.set(k, v);
  }

  const authHeaders = await getWorkerAuthHeaders();
  const url = `${WORKER_API_URL}/api/storage/${bucket}/upload`;
  const res = await fetch(url, { method: 'POST', headers: { ...authHeaders }, body: form });
  const text = await res.text();
  let parsed: { data?: { key?: string; publicUrl?: string | null }; error?: { message?: string; code?: string } };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new WorkerApiError(text || res.statusText, res.status, 'PARSE_ERROR');
  }
  if (!res.ok) {
    throw new WorkerApiError(
      parsed.error?.message ?? res.statusText,
      res.status,
      parsed.error?.code ?? 'HTTP_ERROR',
    );
  }
  return { key: parsed.data?.key ?? key, publicUrl: parsed.data?.publicUrl ?? null };
}
