import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import {
  countEmployeeAttendance,
  getEmployeeById,
  listEmployeeAttendance,
  listEmployees,
} from '../services/employees';

const MAX_EMPLOYEE_LIST = 100;

export async function handleListEmployees(_request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const db = createDb(env);
  const includeTelegram = ctx.role === 'admin';
  const data = await listEmployees(db, MAX_EMPLOYEE_LIST, includeTelegram);
  return apiData(data);
}

export async function handleGetEmployee(
  _request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) {
    return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  }
  const db = createDb(env);
  const includeTelegram = ctx.role === 'admin' || ctx.employeeId === id;
  const row = await getEmployeeById(db, id, includeTelegram);
  if (!row) return apiError('NOT_FOUND', 'Employee not found', 404);
  return apiData(row);
}

export async function handleEmployeeAttendance(
  request: Request,
  env: Env,
  _ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!isUuidLike(id)) {
    return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  }
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) {
    return apiError('BAD_REQUEST', parsed.error, 400);
  }

  const since = url.searchParams.get('since')?.trim() || undefined;
  const until = url.searchParams.get('until')?.trim() || undefined;
  const dateFilters = { since, until };

  const db = createDb(env);
  const employee = await getEmployeeById(db, id);
  if (!employee) return apiError('NOT_FOUND', 'Employee not found', 404);

  const total = await countEmployeeAttendance(db, id, dateFilters);
  const items = await listEmployeeAttendance(db, id, parsed.offset, parsed.limit, dateFilters);
  return apiData({
    items,
    pagination: pageMeta(parsed.page, parsed.pageSize, total),
  });
}
