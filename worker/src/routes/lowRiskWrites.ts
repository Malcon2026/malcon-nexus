import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isEntityId, isUuidLike } from '../lib/http';
import type { RequestContext } from '../middleware/auth';
import { AuthError } from '../middleware/authorization';
import {
  createNotification,
  deleteDailyExpense,
  insertActivityLog,
  markAllNotificationsRead,
  markNotificationRead,
  patchSurgicalKit,
  upsertAppSetting,
  upsertApproval,
  upsertDailyExpense,
} from '../services/lowRiskWrites';

import { writeRelaxed } from '../lib/writeContext';

async function readJson<T>(request: Request): Promise<T | Response> {
  try {
    return (await request.json()) as T;
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }
}

function mapWriteError(e: unknown): Response {
  if (e instanceof AuthError) {
    const code = e.status === 401 ? 'UNAUTHORIZED' : e.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN';
    return apiError(code, e.message, e.status);
  }
  const message = e instanceof Error ? e.message : String(e);
  if (/missing|invalid|no kit fields/i.test(message)) {
    return apiError('BAD_REQUEST', message, 400);
  }
  return apiError('INTERNAL', message, 500);
}

export async function handlePostActivityLog(
  request: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const body = await readJson<Parameters<typeof insertActivityLog>[2]>(request);
  if (body instanceof Response) return body;
  if (!isUuidLike(body.id)) return apiError('BAD_REQUEST', 'Invalid activity id', 400);
  const db = createDb(env);
  try {
    await insertActivityLog(db, ctx, body, writeRelaxed(env));
    return apiData({ ok: true }, 201);
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePostNotification(
  request: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const body = await readJson<Parameters<typeof createNotification>[2]>(request);
  if (body instanceof Response) return body;
  if (!isUuidLike(body.id)) return apiError('BAD_REQUEST', 'Invalid notification id', 400);
  if (body.caseId && !isUuidLike(body.caseId)) return apiError('BAD_REQUEST', 'Invalid caseId', 400);
  if (body.recipientId && !isUuidLike(body.recipientId)) {
    return apiError('BAD_REQUEST', 'Invalid recipientId', 400);
  }
  const db = createDb(env);
  try {
    await createNotification(db, ctx, body, writeRelaxed(env));
    return apiData({ ok: true }, 201);
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePatchNotificationRead(
  _request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid notification id', 400);
  const db = createDb(env);
  try {
    await markNotificationRead(db, ctx, id, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePostNotificationsMarkAllRead(
  request: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const body = await readJson<{ recipientId?: string }>(request);
  if (body instanceof Response) return body;
  if (!body.recipientId || !isUuidLike(body.recipientId)) {
    return apiError('BAD_REQUEST', 'Invalid recipientId', 400);
  }
  const db = createDb(env);
  try {
    await markAllNotificationsRead(db, ctx, body.recipientId, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePatchAppSetting(
  request: Request,
  env: Env,
  ctx: RequestContext,
  key: string,
): Promise<Response> {
  if (!key) return apiError('BAD_REQUEST', 'Missing settings key', 400);
  const body = await readJson<{ value?: string; updatedBy?: string }>(request);
  if (body instanceof Response) return body;
  if (typeof body.value !== 'string') return apiError('BAD_REQUEST', 'Missing value', 400);
  const db = createDb(env);
  try {
    await upsertAppSetting(db, ctx, key, body.value, body.updatedBy ?? '', writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePatchSurgicalKit(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isEntityId(id)) return apiError('BAD_REQUEST', 'Invalid kit id', 400);
  const body = await readJson<{ status?: string; lastUsedDate?: string }>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  try {
    await patchSurgicalKit(db, ctx, id, body, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePutDailyExpense(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid expense id', 400);
  const body = await readJson<Parameters<typeof upsertDailyExpense>[2]>(request);
  if (body instanceof Response) return body;
  if (body.id !== id) return apiError('BAD_REQUEST', 'Body id must match path id', 400);
  if (!isUuidLike(body.employeeId)) return apiError('BAD_REQUEST', 'Invalid employeeId', 400);
  const db = createDb(env);
  try {
    await upsertDailyExpense(db, ctx, body, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handleDeleteDailyExpense(
  _request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid expense id', 400);
  const db = createDb(env);
  try {
    await deleteDailyExpense(db, ctx, id, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePutApproval(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid approval id', 400);
  const body = await readJson<Parameters<typeof upsertApproval>[2]>(request);
  if (body instanceof Response) return body;
  if (body.id !== id) return apiError('BAD_REQUEST', 'Body id must match path id', 400);
  if (!isUuidLike(body.caseId)) return apiError('BAD_REQUEST', 'Invalid caseId', 400);
  const db = createDb(env);
  try {
    await upsertApproval(db, ctx, body, writeRelaxed(env));
    return apiData({ ok: true });
  } catch (e) {
    return mapWriteError(e);
  }
}
