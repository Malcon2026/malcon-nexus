import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError } from '../lib/http';
import { pageMeta, parsePagination } from '../lib/pagination';
import type { RequestContext } from '../middleware/auth';
import { countAttendanceRecords, listAttendanceRecords } from '../services/attendanceRecords';
import {
  countAttendanceApprovals,
  countDailyExpenses,
  countFieldTeamAttendance,
  countFoodSelections,
  countLeaveRequests,
  countLocationTrips,
  countPetrolRequests,
  listAttendanceApprovals,
  listDailyExpenses,
  listFieldTeamAttendance,
  listFoodSelections,
  listLeaveRequests,
  listLocationTrips,
  listPetrolRequests,
} from '../services/operationsData';

function parseOptionalIso(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  return v && v.trim() ? v.trim() : undefined;
}

export async function handleListAttendanceRecords(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);

  const filters = {
    employeeId: url.searchParams.get('employeeId')?.trim() || undefined,
    since: parseOptionalIso(url, 'since'),
    until: parseOptionalIso(url, 'until'),
  };

  const db = createDb(env);
  const total = await countAttendanceRecords(db, filters);
  const items = await listAttendanceRecords(db, filters, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListAttendanceApprovals(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const employeeId = url.searchParams.get('employeeId')?.trim() || undefined;

  const db = createDb(env);
  const total = await countAttendanceApprovals(db, employeeId);
  const items = await listAttendanceApprovals(db, employeeId, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListFieldTeamAttendance(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const dateKey = url.searchParams.get('dateKey')?.trim() || undefined;

  const db = createDb(env);
  if (dateKey) {
    const total = await countFieldTeamAttendance(db, dateKey);
    const items = await listFieldTeamAttendance(db, dateKey, 0, Math.min(total, 500));
    return apiData({ items, pagination: pageMeta(1, items.length || 1, total) });
  }

  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const total = await countFieldTeamAttendance(db, undefined);
  const items = await listFieldTeamAttendance(db, undefined, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListLeaveRequests(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const employeeId = url.searchParams.get('employeeId')?.trim() || undefined;

  const db = createDb(env);
  const total = await countLeaveRequests(db, employeeId);
  const items = await listLeaveRequests(db, employeeId, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListPetrolRequests(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const employeeId = url.searchParams.get('employeeId')?.trim() || undefined;

  const db = createDb(env);
  const total = await countPetrolRequests(db, employeeId);
  const items = await listPetrolRequests(db, employeeId, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListLocationTrips(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const employeeId = url.searchParams.get('employeeId')?.trim() || undefined;

  const db = createDb(env);
  const total = await countLocationTrips(db, employeeId);
  const items = await listLocationTrips(db, employeeId, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListFoodSelections(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);

  const filters = {
    employeeId: url.searchParams.get('employeeId')?.trim() || undefined,
    fromDate: url.searchParams.get('fromDate')?.trim() || undefined,
    toDate: url.searchParams.get('toDate')?.trim() || undefined,
  };

  const db = createDb(env);
  const total = await countFoodSelections(db, filters);
  const items = await listFoodSelections(db, filters, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleListDailyExpenses(request: Request, env: Env, _ctx: RequestContext) {
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);

  const db = createDb(env);
  const total = await countDailyExpenses(db);
  const items = await listDailyExpenses(db, parsed.offset, parsed.limit);
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}
