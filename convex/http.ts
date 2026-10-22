import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { authenticateRequest, requireIdentity, type RequestContext } from './lib/authContext';
import {
  apiData,
  apiError,
  corsHeaders,
  isUuidLike,
  jsonResponse,
  mapEmployeePublic,
  mapEmployeeRoster,
  pageMeta,
  parsePagination,
  camelToSnake,
} from './lib/httpUtil';
import {
  handleStagePhotoList,
  handleStagePhotoThumbnail,
  handleStagePhotoUpload,
  handleStagePhotoView,
} from './lib/stagePhotosHttp';
import { caseNumberPrefixForDate, nextCaseNumberWithPrefix } from './lib/caseNumber';

const http = httpRouter();
const corsOrigin = process.env.API_CORS_ORIGIN || 'https://app.malconnexus.com';

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(corsOrigin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

async function paginatedList(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  table: string,
  url: URL,
): Promise<Response> {
  const parsed = parsePagination(url);
  if ('error' in parsed) return apiError('BAD_REQUEST', parsed.error, 400);
  const { items, total } = await ctx.runQuery(internal.dataQueries.listRows, {
    table,
    offset: parsed.offset,
    limit: parsed.limit,
  });
  return apiData({ items, pagination: pageMeta(parsed.page, parsed.pageSize, total) });
}

async function readJson<T>(request: Request): Promise<T | Response> {
  try {
    return (await request.json()) as T;
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }
}

function filterNotifications(
  items: Record<string, unknown>[],
  recipientId?: string,
  unreadOnly?: boolean,
) {
  return items.filter((row) => {
    if (recipientId && row.recipient_id !== recipientId) return false;
    if (unreadOnly && row.is_read) return false;
    return true;
  });
}

http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpAction(async () => withCors(apiData({ ok: true, backend: 'convex' }))),
});

type HttpCtx = Parameters<Parameters<typeof httpAction>[0]>[0];

/** Resolve the employee row for the current JWT (auth_user_id, then JWT email). */
async function resolveSessionEmployee(
  ctx: HttpCtx,
  auth: RequestContext,
): Promise<Record<string, unknown> | null> {
  if (!auth.identity) return null;
  if (auth.employeeId) {
    const byId = await ctx.runQuery(internal.dataQueries.getRow, {
      table: 'employees',
      legacyId: auth.employeeId,
    });
    if (byId) return byId;
  }
  const byAuth = await ctx.runQuery(internal.dataQueries.employeeByAuthUserId, {
    authUserId: auth.identity.authUserId,
  });
  if (byAuth) return byAuth;
  const email = auth.identity.email?.trim();
  if (!email) return null;
  return ctx.runQuery(internal.dataQueries.employeeByEmail, { email });
}

async function handleSessionMe(ctx: HttpCtx, request: Request): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireIdentity(auth);
  if (denied) return denied;
  const row = await resolveSessionEmployee(ctx, auth);
  if (!row) return apiError('NOT_FOUND', 'Employee not found', 404);
  const employeeId = String(row.id ?? '');
  const includeTelegram = auth.role === 'admin' || auth.employeeId === employeeId;
  return apiData(mapEmployeePublic(row, includeTelegram));
}

http.route({
  path: '/api/me',
  method: 'GET',
  handler: httpAction(async (ctx, request) => withCors(await handleSessionMe(ctx, request))),
});

/** Worker-compatible shape: `{ employee }` (no `data` wrapper). */
http.route({
  path: '/api/auth/me',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const row = await resolveSessionEmployee(ctx, auth);
    if (!row) return withCors(apiError('NOT_FOUND', 'Employee not found', 404));
    const employeeId = String(row.id ?? '');
    const includeTelegram = auth.role === 'admin' || auth.employeeId === employeeId;
    return withCors(jsonResponse({ employee: mapEmployeePublic(row, includeTelegram) }));
  }),
});

http.route({
  path: '/api/employees/link-auth',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const body = await readJson<{ employeeId?: string }>(request);
    if (body instanceof Response) return withCors(body);
    const employeeId = body.employeeId?.trim();
    if (!employeeId || !isUuidLike(employeeId)) {
      return withCors(apiError('BAD_REQUEST', 'Invalid employeeId', 400));
    }
    if (auth.employeeId && auth.employeeId !== employeeId) {
      return withCors(apiError('FORBIDDEN', 'Forbidden', 403));
    }
    const row = await ctx.runQuery(internal.dataQueries.getRow, { table: 'employees', legacyId: employeeId });
    if (!row) return withCors(apiError('NOT_FOUND', 'Employee not found', 404));
    const existingAuth = row.auth_user_id ? String(row.auth_user_id) : '';
    const authUserId = auth.identity!.authUserId;
    if (existingAuth && existingAuth !== authUserId) {
      return withCors(apiError('FORBIDDEN', 'Forbidden', 403));
    }
    const jwtEmail = auth.identity!.email?.trim().toLowerCase();
    const rowEmail = String(row.email ?? '')
      .trim()
      .toLowerCase();
    if (!jwtEmail || !rowEmail || jwtEmail !== rowEmail) {
      return withCors(apiError('FORBIDDEN', 'Forbidden', 403));
    }
    if (existingAuth === authUserId) return withCors(apiData({ ok: true }));
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'employees',
      legacyId: employeeId,
      patch: { auth_user_id: authUserId, updated_at: new Date().toISOString() },
    });
    return withCors(apiData({ ok: true }));
  }),
});

http.route({
  path: '/api/employees',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);

    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'employees' });
    let mapped: Record<string, unknown>[];
    if (auth.role === 'admin') {
      mapped = items.map((r) => mapEmployeePublic(r, true));
    } else if (auth.role === 'store_manager') {
      mapped = items.map((r) => mapEmployeePublic(r, false));
    } else if (auth.role === 'employee' || auth.role === 'petrol') {
      mapped = items.map((r) => mapEmployeeRoster(r));
    } else {
      return withCors(apiError('FORBIDDEN', 'Forbidden', 403));
    }
    return withCors(apiData(mapped.slice(0, 100)));
  }),
});

http.route({
  pathPrefix: '/api/employees/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const path = new URL(request.url).pathname;
    const id = decodeURIComponent(path.slice('/api/employees/'.length).split('/')[0] ?? '');
    if (!isUuidLike(id)) return withCors(apiError('BAD_REQUEST', 'Invalid employee id', 400));
    const row = await ctx.runQuery(internal.dataQueries.getRow, { table: 'employees', legacyId: id });
    if (!row) return withCors(apiError('NOT_FOUND', 'Employee not found', 404));
    const includeTelegram = auth.role === 'admin' || auth.employeeId === id;
    return withCors(apiData(mapEmployeePublic(row, includeTelegram)));
  }),
});

http.route({
  path: '/api/cases/next-number',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    if (auth.role !== 'admin' && auth.role !== 'store_manager') {
      return withCors(apiError('FORBIDDEN', 'Forbidden', 403));
    }
    const url = new URL(request.url);
    const surgeryDate = url.searchParams.get('surgeryDate')?.trim() || undefined;
    const prefix = caseNumberPrefixForDate(surgeryDate ?? new Date());
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, {
      table: 'cases',
      offset: 0,
      limit: 100000,
    });
    const numbers = items
      .map((row) => String(row.case_number ?? ''))
      .filter((cn) => cn.startsWith(prefix));
    const caseNumber = nextCaseNumberWithPrefix(numbers, prefix);
    return withCors(apiData({ caseNumber }));
  }),
});

http.route({
  path: '/api/cases',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    if (auth.role !== 'admin' && auth.role !== 'store_manager') {
      return withCors(apiError('FORBIDDEN', 'Forbidden', 403));
    }
    const url = new URL(request.url);
    const parsed = parsePagination(url);
    if ('error' in parsed) return withCors(apiError('BAD_REQUEST', parsed.error, 400));
    const dayKey = url.searchParams.get('dayKey')?.trim();
    let { items, total } = await ctx.runQuery(internal.dataQueries.listRows, {
      table: 'cases',
      offset: 0,
      limit: 100000,
    });
    if (dayKey) {
      items = items.filter((c) => String(c.surgery_date ?? '').startsWith(dayKey));
      total = items.length;
    }
    const pageItems = items.slice(parsed.offset, parsed.offset + parsed.limit);
    return withCors(
      apiData({ items: pageItems, pagination: pageMeta(parsed.page, parsed.pageSize, total) }),
    );
  }),
});

http.route({
  pathPrefix: '/api/cases/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const path = new URL(request.url).pathname;
    const suffix = path.slice('/api/cases/'.length);
    if (suffix.includes('/')) return withCors(apiError('NOT_FOUND', 'Not found', 404));
    const id = decodeURIComponent(suffix);
    if (!isUuidLike(id)) return withCors(apiError('BAD_REQUEST', 'Invalid case id', 400));
    const row = await ctx.runQuery(internal.dataQueries.getRow, { table: 'cases', legacyId: id });
    if (!row) return withCors(apiError('NOT_FOUND', 'Case not found', 404));
    return withCors(apiData(row));
  }),
});

http.route({
  path: '/api/notifications',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const url = new URL(request.url);
    const parsed = parsePagination(url);
    if ('error' in parsed) return withCors(apiError('BAD_REQUEST', parsed.error, 400));
    let recipientId = url.searchParams.get('recipientId') ?? undefined;
    if (recipientId && !isUuidLike(recipientId)) {
      return withCors(apiError('BAD_REQUEST', 'Invalid recipientId', 400));
    }
    if (auth.role === 'employee' && auth.employeeId) recipientId = auth.employeeId;
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'notifications' });
    const filtered = filterNotifications(items, recipientId, unreadOnly);
    const pageItems = filtered.slice(parsed.offset, parsed.offset + parsed.limit);
    return withCors(
      apiData({
        items: pageItems,
        pagination: pageMeta(parsed.page, parsed.pageSize, filtered.length),
      }),
    );
  }),
});

http.route({
  path: '/api/notifications/summary',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const url = new URL(request.url);
    let recipientId = url.searchParams.get('recipientId') ?? undefined;
    if (auth.role === 'employee' && auth.employeeId) recipientId = auth.employeeId;
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'notifications' });
    const filtered = filterNotifications(items, recipientId, false);
    const unread = filtered.filter((n) => !n.is_read).length;
    return withCors(apiData({ total: filtered.length, unread }));
  }),
});

http.route({
  path: '/api/hospitals',
  method: 'GET',
  handler: httpAction(async (ctx, request) =>
    withCors(await paginatedList(ctx, 'hospitals', new URL(request.url))),
  ),
});

http.route({
  path: '/api/doctors',
  method: 'GET',
  handler: httpAction(async (ctx, request) =>
    withCors(await paginatedList(ctx, 'doctors', new URL(request.url))),
  ),
});

http.route({
  path: '/api/departments',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'departments' });
    return withCors(apiData(items));
  }),
});

http.route({
  path: '/api/surgical-kits',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'surgical_kits' });
    return withCors(apiData(items));
  }),
});

http.route({
  path: '/api/settings',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'app_settings' });
    const map: Record<string, string> = {};
    for (const row of items) {
      if (typeof row.key === 'string') map[row.key] = String(row.value ?? '');
    }
    return withCors(apiData(map));
  }),
});

const GENERIC_LIST_ROUTES: Record<string, string> = {
  '/api/attendance-records': 'attendance_records',
  '/api/attendance-approval-requests': 'attendance_approval_requests',
  '/api/field-team-attendance': 'field_team_attendance_approvals',
  '/api/leave-requests': 'leave_requests',
  '/api/petrol-requests': 'petrol_requests',
  '/api/location-trips': 'location_trips',
  '/api/food-selections': 'employee_food_selections',
  '/api/daily-expenses': 'employee_daily_expenses',
  '/api/approvals': 'approvals',
  '/api/case-task-requests': 'case_task_requests',
  '/api/activity-log': 'activity_log',
};

for (const [path, table] of Object.entries(GENERIC_LIST_ROUTES)) {
  http.route({
    path,
    method: 'GET',
    handler: httpAction(async (ctx, request) =>
      withCors(await paginatedList(ctx, table, new URL(request.url))),
    ),
  });
}

async function handleWrite(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request,
  table: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const auth = await authenticateRequest(ctx, request);
  const denied = requireIdentity(auth);
  if (denied) return denied;
  const snake = camelToSnake(body);
  if (!snake.id && typeof snake.key === 'string') {
    snake.id = snake.key;
  }
  await ctx.runMutation(internal.dataMutations.upsertTableRow, { table, row: snake });
  return apiData({ ok: true }, 201);
}

http.route({
  path: '/api/activity-log',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await readJson<Record<string, unknown>>(request);
    if (body instanceof Response) return withCors(body);
    return withCors(await handleWrite(ctx, request, 'activity_log', body));
  }),
});

http.route({
  path: '/api/notifications',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await readJson<Record<string, unknown>>(request);
    if (body instanceof Response) return withCors(body);
    const row = camelToSnake(body);
    if (typeof row.read === 'boolean') row.is_read = row.read ? 1 : 0;
    return withCors(await handleWrite(ctx, request, 'notifications', row));
  }),
});

http.route({
  pathPrefix: '/api/notifications/',
  method: 'PATCH',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '');
    if (id === 'mark-all-read') return withCors(apiError('BAD_REQUEST', 'Use POST', 400));
    if (!isUuidLike(id)) return withCors(apiError('BAD_REQUEST', 'Invalid notification id', 400));
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'notifications',
      legacyId: id,
      patch: { is_read: 1 },
    });
    return withCors(apiData({ ok: true }));
  }),
});

http.route({
  path: '/api/notifications/mark-all-read',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const body = await readJson<{ recipientId?: string }>(request);
    if (body instanceof Response) return withCors(body);
    if (!body.recipientId || !isUuidLike(body.recipientId)) {
      return withCors(apiError('BAD_REQUEST', 'Invalid recipientId', 400));
    }
    const { items } = await ctx.runQuery(internal.dataQueries.listRows, { table: 'notifications' });
    for (const row of items) {
      if (row.recipient_id === body.recipientId && !row.is_read) {
        await ctx.runMutation(internal.dataMutations.mergeTableRow, {
          table: 'notifications',
          legacyId: String(row.id),
          patch: { is_read: 1 },
        });
      }
    }
    return withCors(apiData({ ok: true }));
  }),
});

http.route({
  pathPrefix: '/api/settings/',
  method: 'PATCH',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const key = decodeURIComponent(new URL(request.url).pathname.slice('/api/settings/'.length));
    const body = await readJson<{ value?: string; updatedBy?: string }>(request);
    if (body instanceof Response) return withCors(body);
    await ctx.runMutation(internal.dataMutations.upsertTableRow, {
      table: 'app_settings',
      row: {
        key,
        value: body.value ?? '',
        updated_by: body.updatedBy ?? '',
        updated_at: new Date().toISOString(),
      },
    });
    return withCors(apiData({ ok: true }));
  }),
});

http.route({
  pathPrefix: '/api/cases/',
  method: 'PUT',
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    const denied = requireIdentity(auth);
    if (denied) return withCors(denied);
    const id = decodeURIComponent(new URL(request.url).pathname.slice('/api/cases/'.length));
    if (!isUuidLike(id)) return withCors(apiError('BAD_REQUEST', 'Invalid case id', 400));
    const body = await readJson<Record<string, unknown>>(request);
    if (body instanceof Response) return withCors(body);
    const patch = camelToSnake(body);
    patch.updated_at = new Date().toISOString();
    await ctx.runMutation(internal.dataMutations.mergeTableRow, {
      table: 'cases',
      legacyId: id,
      patch,
    });
    return withCors(apiData({ ok: true }));
  }),
});

http.route({
  path: '/api/cases',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await readJson<Record<string, unknown>>(request);
    if (body instanceof Response) return withCors(body);
    return withCors(await handleWrite(ctx, request, 'cases', body));
  }),
});

http.route({
  path: '/api/stage-photos/upload',
  method: 'POST',
  handler: httpAction(async (ctx, request) => withCors(await handleStagePhotoUpload(ctx, request))),
});

http.route({
  path: '/api/stage-photos/thumbnail',
  method: 'GET',
  handler: httpAction(async (ctx, request) =>
    withCors(await handleStagePhotoThumbnail(ctx, request)),
  ),
});

http.route({
  path: '/api/stage-photos/view',
  method: 'GET',
  handler: httpAction(async (ctx, request) => withCors(await handleStagePhotoView(ctx, request))),
});

http.route({
  path: '/api/stage-photos/list',
  method: 'GET',
  handler: httpAction(async (ctx, request) => withCors(await handleStagePhotoList(ctx, request))),
});

http.route({
  path: '/',
  method: 'OPTIONS',
  handler: httpAction(async () => withCors(new Response(null, { status: 204 }))),
});

http.route({
  pathPrefix: '/api/',
  method: 'OPTIONS',
  handler: httpAction(async () => withCors(new Response(null, { status: 204 }))),
});

export default http;
