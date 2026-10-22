export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

export function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function apiData<T>(data: T, status = 200, extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ data }, status, extraHeaders);
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: { code, message } }, status, extraHeaders);
}

export function corsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Malcon-Dev-Identity',
    Vary: 'Origin',
  };
  if (origin && origin !== '*') {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export type PageParams = { page: number; pageSize: number; offset: number; limit: number };

export function parsePagination(url: URL): PageParams | { error: string } {
  const pageRaw = url.searchParams.get('page');
  const sizeRaw = url.searchParams.get('pageSize') ?? url.searchParams.get('limit');
  const page = pageRaw == null ? DEFAULT_PAGE : Number(pageRaw);
  const pageSize = sizeRaw == null ? DEFAULT_PAGE_SIZE : Number(sizeRaw);
  if (!Number.isInteger(page) || page < 1) return { error: 'Invalid page (must be integer >= 1)' };
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return { error: 'Invalid pageSize (must be integer >= 1)' };
  }
  if (pageSize > MAX_PAGE_SIZE) return { error: `pageSize must not exceed ${MAX_PAGE_SIZE}` };
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function mapEmployeePublic(row: Record<string, unknown>, includeTelegram: boolean) {
  let departments: string[] = [];
  try {
    departments = JSON.parse(String(row.departments ?? '[]')) as string[];
  } catch {
    departments = [];
  }
  const out: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department,
    departments,
    role: row.role,
    status: row.status,
    avatar: row.avatar,
    phone: row.phone,
    employee_code: row.employee_code ?? null,
    cases_completed: row.cases_completed ?? 0,
    cases_active: row.cases_active ?? 0,
    join_date: row.join_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (includeTelegram) {
    out.telegram_chat_id = row.telegram_chat_id ?? null;
  }
  return out;
}

export function mapEmployeeRoster(row: Record<string, unknown>) {
  let departments: string[] = [];
  try {
    departments = JSON.parse(String(row.departments ?? '[]')) as string[];
  } catch {
    departments = [];
  }
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    departments,
    role: row.role,
    status: row.status,
    avatar: row.avatar,
  };
}

export function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}
