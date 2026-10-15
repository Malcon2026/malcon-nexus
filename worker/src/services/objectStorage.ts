import type { Env, StorageBucketKey } from '../env';
import type { RequestContext } from '../middleware/auth';
import { AuthError, canReadCase } from '../middleware/authorization';
import { createDb } from '../db/client';
import { cases } from '../db/schema';
import { eq } from 'drizzle-orm';
import { loadEmployeeDeptContext } from '../lib/readRouteAuth';

export type { StorageBucketKey } from '../env';

const BUCKET_BINDINGS: Record<StorageBucketKey, keyof Env> = {
  'stage-photos': 'STAGE_PHOTOS',
  'attendance-selfies': 'ATTENDANCE_SELFIES',
  'hr-kyc-uploads': 'HR_KYC_UPLOADS',
};

const S3_BUCKET_ENV: Record<StorageBucketKey, keyof Env> = {
  'stage-photos': 'S3_BUCKET_STAGE_PHOTOS',
  'attendance-selfies': 'S3_BUCKET_ATTENDANCE_SELFIES',
  'hr-kyc-uploads': 'S3_BUCKET_HR_KYC_UPLOADS',
};

function s3BucketName(env: Env, bucket: StorageBucketKey): string | undefined {
  const key = S3_BUCKET_ENV[bucket];
  const name = env[key] as string | undefined;
  return name?.trim() || undefined;
}

export function bucketBinding(env: Env, bucket: StorageBucketKey): R2Bucket | undefined {
  if (s3BucketName(env, bucket) || env.storageHooks) return undefined;
  const key = BUCKET_BINDINGS[bucket];
  return env[key] as R2Bucket | undefined;
}

export function storageConfigured(env: Env): Record<StorageBucketKey, boolean> {
  if (env.storageHooks) {
    return {
      'stage-photos': Boolean(env.S3_BUCKET_STAGE_PHOTOS),
      'attendance-selfies': Boolean(env.S3_BUCKET_ATTENDANCE_SELFIES),
      'hr-kyc-uploads': Boolean(env.S3_BUCKET_HR_KYC_UPLOADS),
    };
  }
  return {
    'stage-photos': Boolean(env.STAGE_PHOTOS || env.S3_BUCKET_STAGE_PHOTOS),
    'attendance-selfies': Boolean(env.ATTENDANCE_SELFIES || env.S3_BUCKET_ATTENDANCE_SELFIES),
    'hr-kyc-uploads': Boolean(env.HR_KYC_UPLOADS || env.S3_BUCKET_HR_KYC_UPLOADS),
  };
}

export async function assertStagePhotoUploadAuth(
  env: Env,
  ctx: RequestContext,
  caseId: string,
  relaxed: boolean,
): Promise<void> {
  if (relaxed && !ctx.identity) return;
  if (!ctx.identity) throw new AuthError('Unauthorized', 401);
  if (!ctx.employeeId) throw new AuthError('Forbidden', 403);
  if (ctx.role === 'admin') return;

  const db = createDb(env);
  const rows = await db
    .select({
      assignedEmployeeId: cases.assignedEmployeeId,
      stagesJson: cases.stages,
      currentStage: cases.currentStage,
      currentDepartment: cases.currentDepartment,
      status: cases.status,
    })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AuthError('Case not found', 404);
  const dept =
    ctx.role === 'admin' || ctx.role === 'store_manager' || !ctx.employeeId
      ? null
      : await loadEmployeeDeptContext(db, ctx.employeeId);
  if (
    !canReadCase(
      ctx,
      {
        assignedEmployeeId: row.assignedEmployeeId,
        stagesJson: row.stagesJson,
        currentStage: row.currentStage,
        currentDepartment: row.currentDepartment,
        status: row.status,
      },
      dept,
    )
  ) {
    throw new AuthError('Forbidden', 403);
  }
}

export async function putObject(
  env: Env,
  bucket: StorageBucketKey,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  if (env.storageHooks?.putObject) {
    await env.storageHooks.putObject(bucket, key, body, contentType);
    return;
  }
  const binding = bucketBinding(env, bucket);
  if (!binding) {
    throw new StorageNotConfiguredError(bucket);
  }
  await binding.put(key, body, {
    httpMetadata: { contentType },
  });
}

export async function deleteObjects(env: Env, bucket: StorageBucketKey, keys: string[]): Promise<void> {
  if (env.storageHooks?.deleteObjects) {
    await env.storageHooks.deleteObjects(bucket, keys);
    return;
  }
  const binding = bucketBinding(env, bucket);
  if (!binding) throw new StorageNotConfiguredError(bucket);
  await Promise.all(keys.map((k) => binding.delete(k)));
}

export class StorageNotConfiguredError extends Error {
  constructor(readonly bucket: StorageBucketKey) {
    super(`Storage bucket "${bucket}" is not configured`);
    this.name = 'StorageNotConfiguredError';
  }
}

export function publicUrlForKey(env: Env, bucket: StorageBucketKey, key: string): string | null {
  if (env.storageHooks?.publicUrlForKey) {
    return env.storageHooks.publicUrlForKey(bucket, key);
  }
  const s3Base = env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (s3Base) {
    return `${s3Base}/${encodeURIComponent(key)}`;
  }
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/${bucket}/${key}`;
}

/** Presigned GET URL (AWS runtime via `storageHooks`). */
export async function signedGetUrlForKey(
  env: Env,
  bucket: StorageBucketKey,
  key: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  return env.storageHooks?.signedGetUrlForKey?.(bucket, key, expiresInSeconds) ?? null;
}
