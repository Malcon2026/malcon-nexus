import { WorkerApiError } from './workerApi';
import { WORKER_API_URL } from './workerReadConfig';
import { getWorkerAuthHeaders } from './workerAuthHeaders';

/** Stage photo upload includes Drive folder resolution — allow extra time on first case/stage. */
export const STAGE_PHOTO_UPLOAD_TIMEOUT_MS = 120_000;

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
  timeoutMs = STAGE_PHOTO_UPLOAD_TIMEOUT_MS,
): Promise<T> {
  const authHeaders = await getWorkerAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${WORKER_API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...authHeaders, ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new WorkerApiError(
        'Photo upload timed out. Check your connection and try again — if this keeps happening, ask admin to confirm the Google Shared drive folder is shared with the upload service account.',
        408,
        'UPLOAD_TIMEOUT',
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
