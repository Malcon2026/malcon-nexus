import type { Env } from '../env';
import { apiData, apiError } from '../lib/http';
import { writeRelaxed } from '../lib/writeContext';
import type { RequestContext } from '../middleware/auth';
import {
  assertStagePhotoUploadAuth,
  deleteObjects,
  publicUrlForKey,
  putObject,
  storageConfigured,
  StorageNotConfiguredError,
  type StorageBucketKey,
} from '../services/objectStorage';
import { AuthError } from '../middleware/authorization';

const ALLOWED_BUCKETS = new Set<StorageBucketKey>([
  'stage-photos',
  'attendance-selfies',
  'hr-kyc-uploads',
]);

function parseBucket(raw: string): StorageBucketKey | null {
  if (ALLOWED_BUCKETS.has(raw as StorageBucketKey)) return raw as StorageBucketKey;
  return null;
}

export async function handleStorageStatus(_request: Request, env: Env): Promise<Response> {
  return apiData({ buckets: storageConfigured(env) });
}

export async function handleStorageUpload(
  request: Request,
  env: Env,
  ctx: RequestContext,
  bucketRaw: string,
): Promise<Response> {
  const bucket = parseBucket(bucketRaw);
  if (!bucket) return apiError('BAD_REQUEST', 'Unknown storage bucket', 400);

  const relaxed = writeRelaxed(env);
  const form = await request.formData();
  const objectKey = String(form.get('key') ?? '').trim();
  const contentType = String(form.get('contentType') ?? 'application/octet-stream');
  const file = form.get('file');

  if (!objectKey || !(file instanceof File)) {
    return apiError('BAD_REQUEST', 'key and file are required', 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return apiError('BAD_REQUEST', 'File must be under 5 MB', 400);
  }

  try {
    if (bucket === 'stage-photos') {
      const caseId = String(form.get('caseId') ?? '');
      if (!caseId) return apiError('BAD_REQUEST', 'caseId is required for stage-photos', 400);
      await assertStagePhotoUploadAuth(env, ctx, caseId, relaxed);
    } else if (bucket === 'attendance-selfies') {
      if (relaxed && !ctx.identity) {
        /* test upload */
      } else if (!ctx.employeeId) {
        throw new AuthError('Forbidden', 403);
      }
    } else if (bucket === 'hr-kyc-uploads') {
      if (relaxed && !ctx.identity) {
        /* test */
      } else if (ctx.role !== 'admin' && !ctx.employeeId) {
        throw new AuthError('Forbidden', 403);
      }
    }

    const bytes = await file.arrayBuffer();
    await putObject(env, bucket, objectKey, bytes, contentType);
    const publicUrl = publicUrlForKey(env, bucket, objectKey);
    return apiData({ ok: true, key: objectKey, publicUrl }, 201);
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return apiError('NOT_CONFIGURED', e.message, 501);
    }
    if (e instanceof AuthError) {
      return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    }
    throw e;
  }
}

export async function handleStorageDelete(
  request: Request,
  env: Env,
  ctx: RequestContext,
  bucketRaw: string,
): Promise<Response> {
  const bucket = parseBucket(bucketRaw);
  if (!bucket) return apiError('BAD_REQUEST', 'Unknown storage bucket', 400);

  const relaxed = writeRelaxed(env);
  if (!relaxed && !ctx.identity) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  let body: { keys?: string[] };
  try {
    body = (await request.json()) as { keys?: string[] };
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }
  const keys = body.keys ?? [];
  if (!keys.length) return apiError('BAD_REQUEST', 'keys array is required', 400);

  try {
    await deleteObjects(env, bucket, keys);
    return apiData({ ok: true });
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return apiError('NOT_CONFIGURED', e.message, 501);
    }
    throw e;
  }
}
