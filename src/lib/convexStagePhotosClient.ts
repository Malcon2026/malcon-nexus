import { WorkerApiError } from './workerApi';
import { WORKER_API_URL } from './workerReadConfig';
import { getWorkerAuthHeaders } from './workerAuthHeaders';

type UploadResponse = {
  data?: {
    id?: string;
    driveFileId?: string;
    type?: string;
    sizeBytes?: number;
  };
  error?: { message?: string; code?: string };
};

type UrlResponse = {
  data?: { thumbnailUrl?: string; viewUrl?: string };
  error?: { message?: string; code?: string };
};

async function convexStagePhotoFetch<T extends UrlResponse | UploadResponse>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const authHeaders = await getWorkerAuthHeaders();
  const res = await fetch(`${WORKER_API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
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
  return parsed;
}

export async function uploadStagePhotoViaConvex(
  caseId: string,
  stage: string,
  file: File,
): Promise<{ id: string; driveFileId: string; type: string; sizeBytes: number }> {
  const form = new FormData();
  form.set('caseId', caseId);
  form.set('stage', stage);
  form.set('file', file);

  const body = await convexStagePhotoFetch<UploadResponse>('/api/stage-photos/upload', {
    method: 'POST',
    body: form,
  });
  const id = body.data?.id;
  const driveFileId = body.data?.driveFileId;
  if (!id || !driveFileId) {
    throw new WorkerApiError('Upload response missing file id', 500, 'INVALID_RESPONSE');
  }
  return {
    id,
    driveFileId,
    type: body.data?.type ?? file.type ?? 'image/jpeg',
    sizeBytes: body.data?.sizeBytes ?? file.size,
  };
}

export async function fetchStagePhotoThumbnailUrl(fileId: string): Promise<string | null> {
  const q = new URLSearchParams({ fileId });
  try {
    const body = await convexStagePhotoFetch<UrlResponse>(`/api/stage-photos/thumbnail?${q}`);
    return body.data?.thumbnailUrl ?? null;
  } catch (e) {
    if (e instanceof WorkerApiError && e.status === 404) return null;
    throw e;
  }
}

export async function fetchStagePhotoViewUrl(fileId: string): Promise<string | null> {
  const q = new URLSearchParams({ fileId });
  const body = await convexStagePhotoFetch<UrlResponse>(`/api/stage-photos/view?${q}`);
  return body.data?.viewUrl ?? null;
}
