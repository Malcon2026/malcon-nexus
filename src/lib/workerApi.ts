/**
 * Local Cloudflare Worker API client (Phase 8). Never touches D1 directly.
 */
import { USE_AWS_BACKEND } from './cloudflareConfig';
import { WORKER_API_URL } from './workerReadConfig';
import { getWorkerAuthHeaders } from './workerAuthHeaders';

export class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'WorkerApiError';
  }
}

type ApiErrorBody = { error?: { code?: string; message?: string } };

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new WorkerApiError(text || res.statusText, res.status, 'PARSE_ERROR');
  }
}

const WORKER_FETCH_TIMEOUT_MS = 60_000;

export async function workerFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${WORKER_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const authHeaders = await getWorkerAuthHeaders();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), WORKER_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...authHeaders,
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new WorkerApiError('Request timed out. Check your connection and try again.', 408, 'TIMEOUT');
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
  }
  const body = (await parseJson(res)) as T & ApiErrorBody;
  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    const message = body?.error?.message ?? res.statusText;
    throw new WorkerApiError(message, res.status, code);
  }
  return body;
}

export type WorkerEmployeeRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  departments: string[];
  role: string;
  status: string;
  avatar: string;
  phone: string;
  employee_code: string | null;
  telegram_chat_id?: string | null;
  cases_completed: number;
  cases_active: number;
  join_date: string;
  created_at: string;
  updated_at: string;
};

export type WorkerCaseListItem = Record<string, unknown>;
export type WorkerCaseDetail = Record<string, unknown>;

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export async function getEmployees(): Promise<WorkerEmployeeRow[]> {
  const body = await workerFetchJson<{ data: WorkerEmployeeRow[] }>('/api/employees');
  return body.data ?? [];
}

export async function getEmployee(id: string): Promise<WorkerEmployeeRow | null> {
  try {
    const body = await workerFetchJson<{ data: WorkerEmployeeRow }>(`/api/employees/${encodeURIComponent(id)}`);
    return body.data ?? null;
  } catch (e) {
    if (e instanceof WorkerApiError && e.status === 404) return null;
    throw e;
  }
}

/** Current session employee (JWT auth_user_id / email lookup on Convex). */
export async function getCurrentEmployee(): Promise<WorkerEmployeeRow | null> {
  try {
    const body = await workerFetchJson<{ data: WorkerEmployeeRow }>('/api/me');
    return body.data ?? null;
  } catch (e) {
    if (e instanceof WorkerApiError && (e.status === 404 || e.status === 401)) return null;
    throw e;
  }
}

export async function getEmployeeAttendance(
  id: string,
  params: { page?: number; pageSize?: number; since?: string; until?: string } = {},
): Promise<Paginated<Record<string, unknown>>> {
  const q = new URLSearchParams();
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  if (params.since) q.set('since', params.since);
  if (params.until) q.set('until', params.until);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const body = await workerFetchJson<{ data: Paginated<Record<string, unknown>> }>(
    `/api/employees/${encodeURIComponent(id)}/attendance${suffix}`,
  );
  return body.data;
}

export async function getCasesPage(params: {
  page?: number;
  pageSize?: number;
  /** IST calendar day — surgery today or updated since that day. */
  dayKey?: string;
  /** Include stages/activity JSON in each row (required for store — list stubs must not be saved). */
  full?: boolean;
}): Promise<Paginated<WorkerCaseDetail>> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 50));
  if (params.dayKey) q.set('dayKey', params.dayKey);
  if (params.full) q.set('full', '1');
  const body = await workerFetchJson<{ data: Paginated<WorkerCaseDetail> }>(`/api/cases?${q.toString()}`);
  return body.data;
}

export async function getCase(id: string): Promise<WorkerCaseDetail | null> {
  try {
    const body = await workerFetchJson<{ data: WorkerCaseDetail }>(`/api/cases/${encodeURIComponent(id)}`);
    return body.data ?? null;
  } catch (e) {
    if (e instanceof WorkerApiError && e.status === 404) return null;
    throw e;
  }
}

const CASE_BOOTSTRAP_PAGE_SIZE = 200;
/** Full rows include large stages JSON — larger pages on RDS cut round-trips vs D1. */
const CASE_FULL_PAGE_SIZE = USE_AWS_BACKEND ? 200 : 60;
/** Parallel page fetches after page 1 (RDS/API Gateway tolerate more concurrency than D1). */
const PAGINATION_PARALLEL_PAGES = USE_AWS_BACKEND ? 4 : 1;
/** Background admin sync — enough for dashboards; open Case History to load more. */
export const ADMIN_BACKGROUND_CASE_CAP = 280;
/** Bounded parallel GET /api/cases/:id for employee-scoped id lists. */
const CASE_DETAIL_CONCURRENCY = 6;

async function fetchAllPaginated<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Paginated<T>>,
  options: { cap?: number; pageSize: number },
): Promise<T[]> {
  const cap = options.cap ?? Number.POSITIVE_INFINITY;
  const pageSize = options.pageSize;
  const out: T[] = [];

  const first = await fetchPage(1, Math.min(pageSize, cap));
  const totalPages = first.pagination.totalPages;
  for (const row of first.items) {
    out.push(row);
    if (out.length >= cap) return out;
  }
  if (totalPages <= 1 || out.length >= cap) return out;

  const remaining: number[] = [];
  for (let p = 2; p <= totalPages; p++) remaining.push(p);

  const parallel = Math.max(1, PAGINATION_PARALLEL_PAGES);
  for (let i = 0; i < remaining.length; i += parallel) {
    const batch = remaining.slice(i, i + parallel);
    const chunks = await Promise.all(
      batch.map((page) => fetchPage(page, Math.min(pageSize, cap - out.length))),
    );
    for (const chunk of chunks) {
      for (const row of chunk.items) {
        out.push(row);
        if (out.length >= cap) return out;
      }
    }
  }
  return out;
}

/** Full case rows from D1 — one paginated API call per chunk (`full=1`). */
export async function getAllCasesViaWorker(options?: { cap?: number }): Promise<WorkerCaseDetail[]> {
  return fetchAllPaginated<WorkerCaseDetail>(
    (page, pageSize) => getCasesPage({ page, pageSize, full: true }),
    { pageSize: CASE_FULL_PAGE_SIZE, cap: options?.cap },
  );
}

export async function getBootstrapDayCasesViaWorker(dayKey: string): Promise<WorkerCaseDetail[]> {
  return fetchAllPaginated<WorkerCaseDetail>(
    (page, pageSize) => getCasesPage({ page, pageSize, dayKey, full: true }),
    { pageSize: CASE_FULL_PAGE_SIZE },
  );
}

export async function getEmployeeCasesFullViaWorker(
  employeeId: string,
  poolStages: string[],
): Promise<WorkerCaseDetail[]> {
  const q = new URLSearchParams();
  if (poolStages.length > 0) q.set('poolStages', poolStages.join(','));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const body = await workerFetchJson<{ data: { items: WorkerCaseDetail[] } }>(
    `/api/cases/for-employee/${encodeURIComponent(employeeId)}/full${suffix}`,
  );
  return body.data?.items ?? [];
}

export type WorkerNotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  case_id: string | null;
  recipient_id: string | null;
  created_at: string;
};

/** Match Supabase employee bootstrap cap; admin uses a higher bounded cap (not full-table). */
export const NOTIFICATION_BOOTSTRAP_CAP_EMPLOYEE = 300;
export const NOTIFICATION_BOOTSTRAP_CAP_ADMIN = 500;
export const NOTIFICATION_BOOTSTRAP_CAP_STAGE1 = 80;
const NOTIFICATION_PAGE_SIZE = 100;

export async function getNotificationsPage(params: {
  page?: number;
  pageSize?: number;
  recipientId?: string;
  unreadOnly?: boolean;
}): Promise<Paginated<WorkerNotificationRow>> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 50));
  if (params.recipientId) q.set('recipientId', params.recipientId);
  if (params.unreadOnly) q.set('unreadOnly', 'true');
  const body = await workerFetchJson<{ data: Paginated<WorkerNotificationRow> }>(
    `/api/notifications?${q.toString()}`,
  );
  return body.data;
}

export async function getNotificationSummary(recipientId?: string): Promise<{ total: number; unread: number }> {
  const q = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
  const body = await workerFetchJson<{ data: { total: number; unread: number } }>(
    `/api/notifications/summary${q}`,
  );
  return body.data;
}

/** Paginated bootstrap load — never downloads the full notifications table. */
export async function getAllNotificationsViaWorker(
  recipientId?: string,
  capOverride?: number,
): Promise<WorkerNotificationRow[]> {
  const cap =
    capOverride ??
    (recipientId ? NOTIFICATION_BOOTSTRAP_CAP_EMPLOYEE : NOTIFICATION_BOOTSTRAP_CAP_ADMIN);
  const pageSize = Math.min(NOTIFICATION_PAGE_SIZE, cap);
  return fetchAllPaginated<WorkerNotificationRow>(
    (page, ps) => getNotificationsPage({ page, pageSize: ps, recipientId }),
    { cap, pageSize },
  );
}

export type WorkerHospitalRow = {
  id: string;
  name: string;
  branch: string;
  address: string;
  city: string;
  contact_person: string;
  phone: string;
  email: string;
  status: string;
};

export type WorkerDoctorRow = {
  id: string;
  name: string;
  specialization: string;
  hospital_id: string | null;
  phone: string;
  doctor_code: string | null;
  master_list_code: string | null;
};

export type WorkerDepartmentRow = {
  id: string;
  name: string;
  description: string;
  color: string;
};

export type WorkerKitRow = {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  status: string;
  last_used_date: string | null;
};

const REFERENCE_PAGE_SIZE = USE_AWS_BACKEND ? 250 : 100;
export const REFERENCE_BOOTSTRAP_CAP = 2000;

export async function getHospitalsPage(page: number, pageSize: number): Promise<Paginated<WorkerHospitalRow>> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const body = await workerFetchJson<{ data: Paginated<WorkerHospitalRow> }>(`/api/hospitals?${q}`);
  return body.data;
}

export async function getAllHospitalsViaWorker(): Promise<WorkerHospitalRow[]> {
  return fetchAllPaginated((page, pageSize) => getHospitalsPage(page, pageSize), {
    cap: REFERENCE_BOOTSTRAP_CAP,
    pageSize: REFERENCE_PAGE_SIZE,
  });
}

export async function getDoctorsPage(page: number, pageSize: number): Promise<Paginated<WorkerDoctorRow>> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const body = await workerFetchJson<{ data: Paginated<WorkerDoctorRow> }>(`/api/doctors?${q}`);
  return body.data;
}

export async function getAllDoctorsViaWorker(): Promise<WorkerDoctorRow[]> {
  return fetchAllPaginated((page, pageSize) => getDoctorsPage(page, pageSize), {
    cap: REFERENCE_BOOTSTRAP_CAP,
    pageSize: REFERENCE_PAGE_SIZE,
  });
}

export async function getDepartmentsViaWorker(): Promise<WorkerDepartmentRow[]> {
  const body = await workerFetchJson<{ data: WorkerDepartmentRow[] }>('/api/departments');
  return body.data ?? [];
}

export async function getSurgicalKitsViaWorker(): Promise<WorkerKitRow[]> {
  const body = await workerFetchJson<{ data: WorkerKitRow[] }>('/api/surgical-kits');
  return body.data ?? [];
}

export async function getAppSettingsViaWorker(): Promise<Record<string, string>> {
  const body = await workerFetchJson<{ data: Record<string, string> }>('/api/settings');
  return body.data ?? {};
}

export type WorkerPgRow = Record<string, unknown>;

const OPERATIONS_PAGE_SIZE = USE_AWS_BACKEND ? 200 : 100;
export const OPERATIONS_BOOTSTRAP_CAP = 2000;
export const ATTENDANCE_BOOTSTRAP_CAP = 5000;
/** Employee register bootstrap — enough history without maxing pagination. */
export const EMPLOYEE_ATTENDANCE_BOOTSTRAP_CAP = USE_AWS_BACKEND ? 1200 : 5000;

async function fetchPaginatedItems(
  path: string,
  params: Record<string, string | undefined>,
  cap: number,
): Promise<WorkerPgRow[]> {
  const pageSize = Math.min(OPERATIONS_PAGE_SIZE, cap);
  return fetchAllPaginated<WorkerPgRow>(
    async (page, ps) => {
      const q = new URLSearchParams({ page: String(page), pageSize: String(ps) });
      for (const [k, v] of Object.entries(params)) {
        if (v) q.set(k, v);
      }
      const body = await workerFetchJson<{ data: Paginated<WorkerPgRow> }>(`${path}?${q.toString()}`);
      return body.data;
    },
    { cap, pageSize },
  );
}

export async function getAllAttendanceRecordsViaWorker(params: {
  employeeId?: string;
  since?: string;
  until?: string;
  cap?: number;
}): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems(
    '/api/attendance-records',
    { employeeId: params.employeeId, since: params.since, until: params.until },
    params.cap ?? ATTENDANCE_BOOTSTRAP_CAP,
  );
}

export async function getRecentEmployeeAttendanceViaWorker(
  employeeId: string,
  sinceIso: string,
  cap = EMPLOYEE_ATTENDANCE_BOOTSTRAP_CAP,
): Promise<WorkerPgRow[]> {
  return fetchAllPaginated<WorkerPgRow>(
    (page, pageSize) =>
      getEmployeeAttendance(employeeId, { page, pageSize, since: sinceIso }).then((chunk) => chunk),
    { cap, pageSize: OPERATIONS_PAGE_SIZE },
  );
}

export async function getAllAttendanceApprovalsViaWorker(employeeId?: string): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/attendance-approval-requests', { employeeId }, OPERATIONS_BOOTSTRAP_CAP);
}

export async function getAllFieldTeamAttendanceViaWorker(dateKey?: string): Promise<WorkerPgRow[]> {
  if (dateKey) {
    const q = new URLSearchParams({ dateKey });
    const body = await workerFetchJson<{ data: Paginated<WorkerPgRow> }>(`/api/field-team-attendance?${q}`);
    return body.data.items ?? [];
  }
  return fetchPaginatedItems('/api/field-team-attendance', {}, OPERATIONS_BOOTSTRAP_CAP);
}

export async function getAllLeaveRequestsViaWorker(employeeId?: string): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/leave-requests', { employeeId }, OPERATIONS_BOOTSTRAP_CAP);
}

export async function getAllPetrolRequestsViaWorker(employeeId?: string): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/petrol-requests', { employeeId }, OPERATIONS_BOOTSTRAP_CAP);
}

export async function getAllLocationTripsViaWorker(employeeId?: string): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/location-trips', { employeeId }, OPERATIONS_BOOTSTRAP_CAP);
}

export async function getAllFoodSelectionsViaWorker(params: {
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems(
    '/api/food-selections',
    { employeeId: params.employeeId, fromDate: params.fromDate, toDate: params.toDate },
    OPERATIONS_BOOTSTRAP_CAP,
  );
}

export async function getAllDailyExpensesViaWorker(): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/daily-expenses', {}, OPERATIONS_BOOTSTRAP_CAP);
}

export async function getEmployeeCaseIdsViaWorker(employeeId: string): Promise<string[]> {
  const body = await workerFetchJson<{ data: { ids: string[] } }>(
    `/api/cases/for-employee/${encodeURIComponent(employeeId)}`,
  );
  return body.data?.ids ?? [];
}

export type FcfsPoolListItem = {
  id: string;
  current_stage: string;
  current_department: string | null;
  status: string;
};

export async function getFcfsPoolListViaWorker(stages: string[]): Promise<FcfsPoolListItem[]> {
  if (stages.length === 0) return [];
  const q = new URLSearchParams({ stages: stages.join(',') });
  const body = await workerFetchJson<{ data: { items: FcfsPoolListItem[] } }>(`/api/cases/fcfs-pool?${q.toString()}`);
  return body.data?.items ?? [];
}

export const QUEUE_READ_CAP = 500;
export const ACTIVITY_READ_CAP = 500;

export async function getAllApprovalsViaWorker(): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/approvals', {}, QUEUE_READ_CAP);
}

export async function getCaseTaskRequestsViaWorker(params: {
  employeeId?: string;
  caseId?: string;
  status?: string;
}): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/case-task-requests', params, QUEUE_READ_CAP);
}

export async function getAllActivityLogViaWorker(): Promise<WorkerPgRow[]> {
  return fetchPaginatedItems('/api/activity-log', {}, ACTIVITY_READ_CAP);
}

/** Detail fetch for server-scoped case id lists (bounded concurrency). */
export async function getCaseDetailsByIds(ids: string[]): Promise<WorkerCaseDetail[]> {
  const unique = [...new Set(ids)];
  const details: WorkerCaseDetail[] = [];
  for (let i = 0; i < unique.length; i += CASE_DETAIL_CONCURRENCY) {
    const chunk = unique.slice(i, i + CASE_DETAIL_CONCURRENCY);
    const rows = await Promise.all(chunk.map((id) => getCase(id)));
    for (const row of rows) {
      if (row) details.push(row);
    }
  }
  return details;
}
