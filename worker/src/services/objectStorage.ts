import type { Env } from '../env';
import type { RequestContext } from '../middleware/auth';
import { AuthError, canReadCase } from '../middleware/authorization';
import { createDb } from '../db/client';
import { cases } from '../db/schema';
import { eq } from 'drizzle-orm';

export type StorageBucketKey = 'stage-photos' | 'attendance-selfies' | 'hr-kyc-uploads';

const BUCKET_BINDINGS: Record<StorageBucketKey, keyof Env> = {
  'stage-photos': 'STAGE_PHOTOS',
  'attendance-selfies': 'ATTENDANCE_SELFIES',
  'hr-kyc-uploads': 'HR_KYC_UPLOADS',
};

export function bucketBinding(env: Env, bucket: StorageBucketKey): R2Bucket | undefined {
  const key = BUCKET_BINDINGS[bucket];
  return env[key] as R2Bucket | undefined;
}

export function storageConfigured(env: Env): Record<StorageBucketKey, boolean> {
  return {
    'stage-photos': Boolean(env.STAGE_PHOTOS),
    'attendance-selfies': Boolean(env.ATTENDANCE_SELFIES),
    'hr-kyc-uploads': Boolean(env.HR_KYC_UPLOADS),
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
    })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AuthError('Case not found', 404);
  if (!canReadCase(ctx, { assignedEmployeeId: row.assignedEmployeeId, stagesJson: row.stagesJson })) {
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
  const binding = bucketBinding(env, bucket);
  if (!binding) {
    throw new StorageNotConfiguredError(bucket);
  }
  await binding.put(key, body, {
    httpMetadata: { contentType },
  });
}

export async function deleteObjects(env: Env, bucket: StorageBucketKey, keys: string[]): Promise<void> {
  const binding = bucketBinding(env, bucket);
  if (!binding) throw new StorageNotConfiguredError(bucket);
  await Promise.all(keys.map((k) => binding.delete(k)));
}

export class StorageNotConfiguredError extends Error {
  constructor(readonly bucket: StorageBucketKey) {
    super(`R2 bucket "${bucket}" is not bound on this Worker`);
    this.name = 'StorageNotConfiguredError';
  }
}

export function publicUrlForKey(env: Env, bucket: StorageBucketKey, key: string): string | null {
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/${bucket}/${key}`;
}
