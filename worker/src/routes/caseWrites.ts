import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { writeRelaxed } from '../lib/writeContext';
import type { RequestContext } from '../middleware/auth';
import {
  claimCaseFcfs,
  createCase,
  deleteCase,
  saveCaseForSession,
  syncCaseHeader,
  type CaseWritePayload,
} from '../services/mediumRisk/caseWrites';
import { mapWriteError, readJson } from './writeHelpers';

async function run(handler: () => Promise<void>, status = 200): Promise<Response> {
  try {
    await handler();
    return apiData({ ok: true }, status);
  } catch (e) {
    return mapWriteError(e);
  }
}

function mapWriteErrorWithConflict(e: unknown): Response {
  if (e instanceof Error && 'status' in e && (e as { status: number }).status === 409) {
    return apiError('CONFLICT', e.message, 409);
  }
  return mapWriteError(e);
}

export async function handlePostCase(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<CaseWritePayload>(request);
  if (body instanceof Response) return body;
  if (!isUuidLike(body.id as string)) return apiError('BAD_REQUEST', 'Invalid case id', 400);
  const db = createDb(env);
  return run(() => createCase(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePutCase(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid case id', 400);
  const body = await readJson<CaseWritePayload>(request);
  if (body instanceof Response) return body;
  if ((body.id as string) !== id) return apiError('BAD_REQUEST', 'Body id must match path id', 400);
  const db = createDb(env);
  try {
    await saveCaseForSession(db, ctx, body, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteErrorWithConflict(e);
  }
}

export async function handleDeleteCase(_request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid case id', 400);
  const db = createDb(env);
  return run(() => deleteCase(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostCaseSaveSession(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  return handlePutCase(request, env, ctx, id);
}

export async function handlePostCaseSyncHeader(
  _request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid case id', 400);
  const db = createDb(env);
  return run(() => syncCaseHeader(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostCaseClaim(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid case id', 400);
  const body = await readJson<{ employee: { id: string; name: string; department: string } }>(request);
  if (body instanceof Response) return body;
  if (!body.employee?.id || !isUuidLike(body.employee.id)) {
    return apiError('BAD_REQUEST', 'Invalid employee', 400);
  }
  const db = createDb(env);
  try {
    const data = await claimCaseFcfs(env, db, ctx, id, body.employee, writeRelaxed(env));
    return apiData({ case: data });
  } catch (e) {
    return mapWriteErrorWithConflict(e);
  }
}
