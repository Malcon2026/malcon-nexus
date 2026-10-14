import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import { countCases, getCaseDetail, listCases } from '../services/cases';

export async function handleListCases(request: Request, env: Env, _ctx: RequestContext): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) {
    return apiError('BAD_REQUEST', parsed.error, 400);
  }

  const dayKey = url.searchParams.get('dayKey')?.trim() || undefined;
  if (dayKey && !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return apiError('BAD_REQUEST', 'dayKey must be YYYY-MM-DD', 400);
  }

  const db = createDb(env);
  const total = await countCases(db, dayKey);
  const items = await listCases(db, parsed.offset, parsed.limit, dayKey);
  return apiData({
    items,
    pagination: pageMeta(parsed.page, parsed.pageSize, total),
  });
}

export async function handleGetCase(
  _request: Request,
  env: Env,
  _ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) {
    return apiError('BAD_REQUEST', 'Invalid case id', 400);
  }
  const db = createDb(env);
  const row = await getCaseDetail(db, id);
  if (!row) return apiError('NOT_FOUND', 'Case not found', 404);
  return apiData(row);
}
