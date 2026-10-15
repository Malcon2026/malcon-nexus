import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import { AuthError, canReadCase } from '../middleware/authorization';
import { countCases, getCaseDetail, listCases, listCasesFull } from '../services/cases';
import { loadEmployeeDeptContext, requireAdminOrStoreManager } from '../lib/readRouteAuth';

function authErrorResponse(e: AuthError): Response {
  return apiError(e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', e.message, e.status);
}

export async function handleListCases(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  try {
    requireAdminOrStoreManager(ctx);
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e);
    throw e;
  }

  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) {
    return apiError('BAD_REQUEST', parsed.error, 400);
  }

  const dayKey = url.searchParams.get('dayKey')?.trim() || undefined;
  if (dayKey && !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return apiError('BAD_REQUEST', 'dayKey must be YYYY-MM-DD', 400);
  }

  const full = url.searchParams.get('full') === '1' || url.searchParams.get('full') === 'true';

  const db = createDb(env);
  const total = await countCases(db, dayKey);
  const items = full
    ? await listCasesFull(db, parsed.offset, parsed.limit, dayKey)
    : await listCases(db, parsed.offset, parsed.limit, dayKey);
  return apiData({
    items,
    pagination: pageMeta(parsed.page, parsed.pageSize, total),
  });
}

export async function handleGetCase(
  _request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) {
    return apiError('BAD_REQUEST', 'Invalid case id', 400);
  }
  const db = createDb(env);
  const row = await getCaseDetail(db, id);
  if (!row) return apiError('NOT_FOUND', 'Case not found', 404);

  const dept =
    ctx.role === 'admin' || ctx.role === 'store_manager' || !ctx.employeeId
      ? null
      : await loadEmployeeDeptContext(db, ctx.employeeId);

  const stagesJson = JSON.stringify(row.stages ?? []);
  if (
    !canReadCase(
      ctx,
      {
        assignedEmployeeId: (row.assigned_employee_id as string | null) ?? null,
        stagesJson,
        currentStage: String(row.current_stage ?? ''),
        currentDepartment: (row.current_department as string | null) ?? null,
        status: String(row.status ?? ''),
      },
      dept,
    )
  ) {
    return apiError('FORBIDDEN', 'Forbidden', 403);
  }

  return apiData(row);
}
