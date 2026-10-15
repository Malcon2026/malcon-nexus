import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import { AuthError, requireEmployeeAccess, canReadCase } from '../middleware/authorization';
import { employeeCanClaimFcfsCase } from '../lib/caseReadAuth';
import { loadEmployeeDeptContext, requireAdminOrStoreManager } from '../lib/readRouteAuth';
import { listCaseIdsForEmployee, listFcfsPoolCaseIds } from '../services/caseScope';
import { getCaseDetailsByIds } from '../services/cases';
import { cases } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  ACTIVITY_READ_CAP,
  countActivityLog,
  countApprovals,
  countCaseTaskRequests,
  listActivityLog,
  listApprovals,
  listCaseTaskRequests,
} from '../services/workflowReads';

export async function handleListApprovals(request: Request, env: Env, ctx: RequestContext) {
  try {
    requireAdminOrStoreManager(ctx);
  } catch (e) {
    if (e instanceof AuthError) {
      return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    }
    throw e;
  }

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

export async function handleListActivityLog(request: Request, env: Env, ctx: RequestContext) {
  if (!ctx.identity) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }
  if (ctx.role !== 'admin' && ctx.role !== 'employee' && ctx.role !== 'store_manager') {
    return apiError('FORBIDDEN', 'Forbidden', 403);
  }

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
  ctx: RequestContext,
  employeeId: string,
) {
  if (!isUuidLike(employeeId)) return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  try {
    requireEmployeeAccess(ctx, employeeId);
  } catch (e) {
    if (e instanceof AuthError) {
      return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    }
    throw e;
  }
  const db = createDb(env);
  const ids = await listCaseIdsForEmployee(db, employeeId);
  return apiData({ ids });
}

/** Assigned + optional FCFS pool cases with full stages — one HTTP call for employee login. */
export async function handleEmployeeCasesFull(
  request: Request,
  env: Env,
  ctx: RequestContext,
  employeeId: string,
) {
  if (!isUuidLike(employeeId)) return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  try {
    requireEmployeeAccess(ctx, employeeId);
  } catch (e) {
    if (e instanceof AuthError) {
      return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
    }
    throw e;
  }

  const url = new URL(request.url);
  const poolStagesRaw = url.searchParams.get('poolStages')?.trim() ?? '';
  const poolStages = poolStagesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const db = createDb(env);
  const assignedIds = await listCaseIdsForEmployee(db, employeeId);
  let poolIds: string[] = [];
  if (poolStages.length > 0) {
    const pool = await listFcfsPoolCaseIds(db, poolStages);
    poolIds = pool.map((p) => p.id);
  }
  const ids = [...new Set([...assignedIds, ...poolIds])];
  const items = await getCaseDetailsByIds(db, ids);
  const dept = await loadEmployeeDeptContext(db, employeeId);
  const visible = items.filter((item) =>
    canReadCase(
      ctx,
      {
        assignedEmployeeId: (item.assigned_employee_id as string | null) ?? null,
        stagesJson: JSON.stringify(item.stages ?? []),
        currentStage: String(item.current_stage ?? ''),
        currentDepartment: (item.current_department as string | null) ?? null,
        status: String(item.status ?? ''),
      },
      dept,
    ),
  );
  return apiData({ items: visible });
}

export async function handleFcfsPoolCases(request: Request, env: Env, ctx: RequestContext) {
  if (!ctx.identity || !ctx.employeeId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }
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
  const dept = await loadEmployeeDeptContext(db, ctx.employeeId);
  if (!dept) return apiData({ items: [] });
  const items = await listFcfsPoolCaseIds(db, stages);
  const ids = items.map((i) => i.id);
  if (ids.length === 0) return apiData({ items: [] });
  const rows = await db
    .select({
      id: cases.id,
      currentStage: cases.currentStage,
      currentDepartment: cases.currentDepartment,
    })
    .from(cases)
    .where(inArray(cases.id, ids));
  const allowedIds = new Set(
    rows
      .filter((r) => employeeCanClaimFcfsCase(r.currentStage, r.currentDepartment, dept))
      .map((r) => r.id),
  );
  return apiData({ items: items.filter((i) => allowedIds.has(i.id)) });
}
