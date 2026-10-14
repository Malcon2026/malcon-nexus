import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import { listCaseIdsForEmployee, listFcfsPoolCaseIds } from '../services/caseScope';
import {
  ACTIVITY_READ_CAP,
  countActivityLog,
  countApprovals,
  countCaseTaskRequests,
  listActivityLog,
  listApprovals,
  listCaseTaskRequests,
} from '../services/workflowReads';

export async function handleListApprovals(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);

  const db = createDb(env);
  const total = await countApprovals(db);
  const items = await listApprovals(db, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListCaseTaskRequests(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);

  const filters = {
    employeeId: url.searchParams.get('employeeId')?.trim() || undefined,
    caseId: url.searchParams.get('caseId')?.trim() || undefined,
    status: url.searchParams.get('status')?.trim() || undefined,
  };
  if (filters.employeeId && !isUuidLike(filters.employeeId)) {
    return apiError('BAD_REQUEST', 'Invalid employeeId', 400);
  }
  if (filters.caseId && !isUuidLike(filters.caseId)) {
    return apiError('BAD_REQUEST', 'Invalid caseId', 400);
  }

  const db = createDb(env);
  const total = await countCaseTaskRequests(db, filters);
  const items = await listCaseTaskRequests(db, filters, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListActivityLog(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);

  const db = createDb(env);
  const total = Math.min(await countActivityLog(db), ACTIVITY_READ_CAP);
  const items = await listActivityLog(db, parsed.offset, parsed.limit);
  return apiData({
    items,
    pagination: pageMeta(parsed.page, parsed.pageSize, total),
  });
}

export async function handleEmployeeCaseIds(
  _request: Request,
  env: Env,
  _ctx: RequestContext,
  employeeId: string,
) {
  if (!isUuidLike(employeeId)) return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  const db = createDb(env);
  const ids = await listCaseIdsForEmployee(db, employeeId);
  return apiData({ ids });
}

export async function handleFcfsPoolCases(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const stagesRaw = url.searchParams.get('stages')?.trim() ?? '';
  const stages = stagesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (stages.length === 0) {
    return apiData({ items: [] });
  }
  const db = createDb(env);
  const items = await listFcfsPoolCaseIds(db, stages);
  return apiData({ items });
}
