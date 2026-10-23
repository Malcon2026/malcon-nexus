import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { RequestContext } from './authContext';
import {
  apiData,
  apiError,
  camelToSnake,
  isUuidLike,
  pageMeta,
  parsePagination,
} from './httpUtil';
import { requireAdminOrStoreManager } from './httpAuthHelpers';
import {
  canReadCaseRow,
  caseRowToReadShape,
  employeeCanClaimFcfsCase,
  type EmployeeDeptContext,
} from './caseReadAuth';
import { employeeIsAssigneeOnStages, stagesToJson } from './caseAssignee';

const MAX_EMPLOYEE_CASE_IDS = 300;
const MAX_FCFS_POOL_IDS = 150;

function istDayStartIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+05:30`).toISOString();
}

export function matchesBootstrapDay(row: Record<string, unknown>, dayKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return false;
  const surgery = String(row.surgery_date ?? '').slice(0, 10);
  if (surgery === dayKey) return true;
  const updatedAt = String(row.updated_at ?? '');
  if (!updatedAt) return false;
  return updatedAt >= istDayStartIso(dayKey);
}

function requireEmployeeAccess(auth: RequestContext, targetEmployeeId: string): Response | null {
  if (!auth.identity) return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  if (auth.role === 'admin' || auth.role === 'store_manager') return null;
  if (auth.employeeId !== targetEmployeeId) return apiError('FORBIDDEN', 'Forbidden', 403);
  return null;
}

async function loadAllCaseRows(ctx: ActionCtx): Promise<Record<string, unknown>[]> {
  const { items } = await ctx.runQuery(internal.dataQueries.listRows, {
    table: 'cases',
    offset: 0,
    limit: 100000,
  });
  return items;
}

async function loadEmployeeDeptContext(
  ctx: ActionCtx,
  employeeId: string,
): Promise<EmployeeDeptContext | null> {
  const row = await ctx.runQuery(internal.dataQueries.getRow, {
    table: 'employees',
    legacyId: employeeId,
  });
  if (!row) return null;
  return {
    department: String(row.department ?? ''),
    departments: String(row.departments ?? '[]'),
  };
}

function listCaseIdsForEmployee(rows: Record<string, unknown>[], employeeId: string): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const id = String(row.id ?? '');
    if (!id) continue;
    const assigned = String(row.assigned_employee_id ?? '');
    if (assigned === employeeId) {
      out.push(id);
      continue;
    }
    const stagesJson = stagesToJson(row.stages);
    if (stagesJson.includes(employeeId)) {
      out.push(id);
      continue;
    }
    const snap = row.assigned_employee_snapshot as { id?: string } | null | undefined;
    if (snap?.id === employeeId) out.push(id);
  }
  return out.slice(0, MAX_EMPLOYEE_CASE_IDS);
}

function listFcfsPoolCaseIds(rows: Record<string, unknown>[], stages: string[]) {
  if (stages.length === 0) return [];
  const stageSet = new Set(stages);
  const out: {
    id: string;
    current_stage: string;
    current_department: string | null;
    status: string;
  }[] = [];
  for (const row of rows) {
    if (row.assigned_employee_id) continue;
    const status = String(row.status ?? '');
    if (status !== 'Active' && status !== 'Draft') continue;
    const currentStage = String(row.current_stage ?? '');
    if (!stageSet.has(currentStage)) continue;
    const id = String(row.id ?? '');
    if (!id) continue;
    out.push({
      id,
      current_stage: currentStage,
      current_department: (row.current_department as string | null) ?? null,
      status,
    });
    if (out.length >= MAX_FCFS_POOL_IDS) break;
  }
  return out;
}

function sortCasesByUpdatedDesc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) =>
    String(b.updated_at ?? b.created_at ?? '').localeCompare(
      String(a.updated_at ?? a.created_at ?? ''),
    ),
  );
}

export async function handleCreateCase(
  ctx: ActionCtx,
  auth: RequestContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const denied = requireAdminOrStoreManager(auth);
  if (denied) return denied;
  const row = camelToSnake(body);
  if (!row.id && typeof row.key === 'string') row.id = row.key;
  if (typeof row.id !== 'string' || !isUuidLike(row.id)) {
    return apiError('BAD_REQUEST', 'Invalid case id', 400);
  }
  const now = new Date().toISOString();
  if (!row.created_at) row.created_at = now;
  row.updated_at = typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : now;
  await ctx.runMutation(internal.dataMutations.upsertTableRow, { table: 'cases', row });
  return apiData({ ok: true, id: row.id }, 201);
}

export async function handleListCases(ctx: ActionCtx, auth: RequestContext, request: Request) {
  if (auth.role !== 'admin' && auth.role !== 'store_manager') {
    return apiError('FORBIDDEN', 'Forbidden', 403);
  }
  const url = new URL(request.url);
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const dayKey = url.searchParams.get('dayKey')?.trim();
  if (dayKey && !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return apiError('BAD_REQUEST', 'dayKey must be YYYY-MM-DD', 400);
  }

  let items = sortCasesByUpdatedDesc(await loadAllCaseRows(ctx));
  if (dayKey) {
    items = items.filter((c) => matchesBootstrapDay(c, dayKey));
  }
  const total = items.length;
  const pageItems = items.slice(parsed.offset, parsed.offset + parsed.limit);
  return apiData({ items: pageItems, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

export async function handleGetCase(ctx: ActionCtx, auth: RequestContext, id: string) {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', 'Invalid case id', 400);
  const row = await ctx.runQuery(internal.dataQueries.getRow, { table: 'cases', legacyId: id });
  if (!row) return apiError('NOT_FOUND', 'Case not found', 404);

  const dept =
    auth.role === 'admin' || auth.role === 'store_manager' || !auth.employeeId
      ? null
      : await loadEmployeeDeptContext(ctx, auth.employeeId);

  if (!canReadCaseRow(auth, caseRowToReadShape(row), dept)) {
    return apiError('FORBIDDEN', 'Forbidden', 403);
  }
  return apiData(row);
}

export async function handleEmployeeCaseIds(
  ctx: ActionCtx,
  auth: RequestContext,
  employeeId: string,
) {
  if (!isUuidLike(employeeId)) return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  const denied = requireEmployeeAccess(auth, employeeId);
  if (denied) return denied;
  const ids = listCaseIdsForEmployee(await loadAllCaseRows(ctx), employeeId);
  return apiData({ ids });
}

export async function handleEmployeeCasesFull(
  ctx: ActionCtx,
  auth: RequestContext,
  request: Request,
  employeeId: string,
) {
  if (!isUuidLike(employeeId)) return apiError('BAD_REQUEST', 'Invalid employee id', 400);
  const denied = requireEmployeeAccess(auth, employeeId);
  if (denied) return denied;

  const url = new URL(request.url);
  const poolStagesRaw = url.searchParams.get('poolStages')?.trim() ?? '';
  const poolStages = poolStagesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allRows = await loadAllCaseRows(ctx);
  const assignedIds = listCaseIdsForEmployee(allRows, employeeId);
  let poolIds: string[] = [];
  if (poolStages.length > 0) {
    poolIds = listFcfsPoolCaseIds(allRows, poolStages).map((p) => p.id);
  }
  const idSet = new Set([...assignedIds, ...poolIds]);
  const dept = await loadEmployeeDeptContext(ctx, employeeId);
  const items = allRows.filter((row) => {
    const id = String(row.id ?? '');
    if (!idSet.has(id)) return false;
    return canReadCaseRow(auth, caseRowToReadShape(row), dept);
  });
  return apiData({ items });
}

export async function handleFcfsPoolCases(ctx: ActionCtx, auth: RequestContext, request: Request) {
  if (!auth.identity || !auth.employeeId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }
  const url = new URL(request.url);
  const stagesRaw = url.searchParams.get('stages')?.trim() ?? '';
  const stages = stagesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (stages.length === 0) return apiData({ items: [] });

  const dept = await loadEmployeeDeptContext(ctx, auth.employeeId);
  if (!dept) return apiData({ items: [] });

  const pool = listFcfsPoolCaseIds(await loadAllCaseRows(ctx), stages);
  const items = pool.filter((item) =>
    employeeCanClaimFcfsCase(item.current_stage, item.current_department, dept),
  );
  return apiData({ items });
}

/** Parse `/api/cases/for-employee/:id` or `.../full`. */
export function parseForEmployeeCasePath(pathname: string): { employeeId: string; full: boolean } | null {
  const prefix = '/api/cases/for-employee/';
  if (!pathname.startsWith(prefix)) return null;
  const rest = decodeURIComponent(pathname.slice(prefix.length));
  const full = rest.endsWith('/full');
  const idPart = full ? rest.slice(0, -'/full'.length) : rest;
  if (!idPart || idPart.includes('/')) return null;
  return { employeeId: idPart, full };
}

export { employeeIsAssigneeOnStages };
