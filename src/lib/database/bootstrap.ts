import { supabaseStorage } from './storage';
import {
  sbEmployeeRepo,
  sbHospitalRepo,
  sbDoctorRepo,
  sbCaseRepo,
  sbNotificationRepo,
  sbApprovalRepo,
  sbActivityRepo,
  sbDepartmentRepo,
  sbKitRepo,
  sbAttendanceRepo,
  sbAttendanceApprovalRepo,
  sbLeaveRepo,
} from './repositories/supabaseRepositories';

type BootstrapRole = 'admin' | 'employee';

export interface BootstrapOptions {
  employeeId?: string;
}

export interface BootstrapRunOptions {
  /** Bypass session cache TTL and always fetch from Supabase. */
  force?: boolean;
}

interface BootstrapTask {
  key: string;
  run: () => Promise<unknown>;
}

interface BootstrapCachePayload {
  savedAt: number;
  data: Record<string, unknown[]>;
}

const CACHE_PREFIX = 'malcon-nexus-bootstrap-v1';
const ATTENDANCE_LOOKBACK_DAYS = 150;
/** Skip essential re-fetch when session cache is newer than this. */
const CACHE_TTL_MS = 5 * 60 * 1000;

function getAttendanceBootstrapSinceIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - ATTENDANCE_LOOKBACK_DAYS);
  return date.toISOString();
}

function cacheKey(employeeId: string): string {
  return `${CACHE_PREFIX}:${employeeId}`;
}

function readBootstrapCache(employeeId: string): BootstrapCachePayload | null {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(cacheKey(employeeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootstrapCachePayload;
    if (!parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Only what the employee dashboard needs painted immediately: today's
// punch status (derived from recent records the store already has after
// first deferred load) needs pending-approval + leave state, not months of
// attendance history. Keeping this tier small is what actually makes the
// login screen feel fast.
function employeeEssentialTasks(employeeId: string): BootstrapTask[] {
  return [
    { key: 'leaveRequests', run: () => sbLeaveRepo.getForEmployee(employeeId) },
    {
      key: 'attendanceApprovalRequests',
      run: () => sbAttendanceApprovalRepo.getForEmployee(employeeId),
    },
  ];
}

function employeeDeferredTasks(employeeId?: string): BootstrapTask[] {
  if (employeeId) {
    const sinceIso = getAttendanceBootstrapSinceIso();
    return [
      // 150-day attendance history is only needed by the (lazy-loaded)
      // Attendance Register further down the dashboard — never blocks login.
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentForEmployee(employeeId, sinceIso) },
      // Not read by any employee-facing screen today; still loaded in the
      // background in case something needs it, just never blocking.
      { key: 'departments', run: () => sbDepartmentRepo.getAll() },
      { key: 'cases', run: () => sbCaseRepo.getForEmployee(employeeId) },
      { key: 'notifications', run: () => sbNotificationRepo.getAll(employeeId) },
    ];
  }

  return [
    { key: 'cases', run: () => sbCaseRepo.getAll() },
    { key: 'notifications', run: () => sbNotificationRepo.getAll() },
  ];
}

function adminEssentialTasks(): BootstrapTask[] {
  return [
    { key: 'cases', run: () => sbCaseRepo.getAll() },
    { key: 'notifications', run: () => sbNotificationRepo.getAll() },
    { key: 'attendanceRecords', run: () => sbAttendanceRepo.getAll() },
    { key: 'attendanceApprovalRequests', run: () => sbAttendanceApprovalRepo.getAll() },
    { key: 'leaveRequests', run: () => sbLeaveRepo.getAll() },
    { key: 'departments', run: () => sbDepartmentRepo.getAll() },
    { key: 'employees', run: () => sbEmployeeRepo.getAll() },
    { key: 'hospitals', run: () => sbHospitalRepo.getAll() },
    { key: 'doctors', run: () => sbDoctorRepo.getAll() },
    { key: 'approvals', run: () => sbApprovalRepo.getAll() },
  ];
}

function adminDeferredTasks(): BootstrapTask[] {
  return [
    { key: 'kits', run: () => sbKitRepo.getAll() },
    { key: 'activityLog', run: () => sbActivityRepo.getAll() },
  ];
}

function tasksFor(role: BootstrapRole, tier: 'essential' | 'deferred', options?: BootstrapOptions): BootstrapTask[] {
  if (role === 'employee') {
    if (!options?.employeeId) {
      return employeeDeferredTasks();
    }
    return tier === 'essential'
      ? employeeEssentialTasks(options.employeeId)
      : employeeDeferredTasks(options.employeeId);
  }

  return tier === 'essential' ? adminEssentialTasks() : adminDeferredTasks();
}

function shouldSkipEssentialFetch(
  role: BootstrapRole,
  options: BootstrapOptions | undefined,
  runOptions?: BootstrapRunOptions,
): boolean {
  if (runOptions?.force || !options?.employeeId) return false;
  return isBootstrapCacheFresh(options.employeeId);
}

async function runBootstrapTasks(tasks: BootstrapTask[], tier: string): Promise<void> {
  if (!supabaseStorage || tasks.length === 0) return;

  const startedAt = performance.now();
  const timedTasks = tasks.map((t) => {
    const taskStart = performance.now();
    return t.run().then(
      (value) => ({ value, ms: performance.now() - taskStart }),
      (reason) => Promise.reject({ reason, ms: performance.now() - taskStart }),
    );
  });
  const results = await Promise.allSettled(timedTasks);

  let slowestKey = '';
  let slowestMs = 0;
  results.forEach((result, i) => {
    const key = tasks[i].key;
    if (result.status === 'rejected') {
      const { reason, ms } = result.reason as { reason: unknown; ms: number };
      console.warn(`[bootstrap] Failed to load ${key} (${Math.round(ms)}ms):`, reason);
      return;
    }
    const { value, ms } = result.value;
    if (ms > slowestMs) { slowestMs = ms; slowestKey = key; }
    supabaseStorage!.seedCache(key, value as unknown[]);
  });

  console.info(
    `[perf] bootstrap ${tier} finished in ${Math.round(performance.now() - startedAt)}ms` +
      (slowestKey ? ` (slowest: ${slowestKey} ${Math.round(slowestMs)}ms)` : ''),
  );
}

/** True when session cache exists and is within TTL. */
export function isBootstrapCacheFresh(employeeId: string): boolean {
  const parsed = readBootstrapCache(employeeId);
  if (!parsed?.savedAt) return false;
  return Date.now() - parsed.savedAt < CACHE_TTL_MS;
}

/** Restore last session cache so the UI can render immediately on reopen. */
export function restoreBootstrapCache(employeeId: string): boolean {
  if (!supabaseStorage) return false;

  const parsed = readBootstrapCache(employeeId);
  if (!parsed) return false;

  for (const [key, value] of Object.entries(parsed.data)) {
    supabaseStorage.seedCache(key, value);
  }
  return true;
}

/** Persist loaded collections for fast next open in the same browser session. */
export function persistBootstrapCache(employeeId: string, role: BootstrapRole): void {
  if (!supabaseStorage || typeof sessionStorage === 'undefined') return;

  const keys =
    role === 'admin'
      ? [
          'cases',
          'notifications',
          'attendanceRecords',
          'attendanceApprovalRequests',
          'leaveRequests',
          'departments',
          'employees',
          'hospitals',
          'doctors',
          'approvals',
          'kits',
          'activityLog',
        ]
      : [
          'attendanceRecords',
          'leaveRequests',
          'attendanceApprovalRequests',
          'departments',
          'cases',
          'notifications',
        ];

  const data: Record<string, unknown[]> = {};
  for (const key of keys) {
    const value = supabaseStorage.getItem<unknown[]>(key);
    if (value) data[key] = value;
  }

  try {
    sessionStorage.setItem(cacheKey(employeeId), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // sessionStorage full — ignore
  }
}

/** Load data needed for the first interactive screen (attendance, leave). Returns false when skipped (fresh cache). */
export async function bootstrapEssential(
  role: BootstrapRole,
  options?: BootstrapOptions,
  runOptions?: BootstrapRunOptions,
): Promise<boolean> {
  if (shouldSkipEssentialFetch(role, options, runOptions)) {
    return false;
  }

  await runBootstrapTasks(tasksFor(role, 'essential', options), 'essential');
  return true;
}

/** Load heavier collections after the shell is visible. */
export async function bootstrapDeferred(
  role: BootstrapRole,
  options?: BootstrapOptions,
  _runOptions?: BootstrapRunOptions,
): Promise<void> {
  await runBootstrapTasks(tasksFor(role, 'deferred', options), 'deferred');
}

/** Full bootstrap — used after login and manual refresh. */
export async function bootstrapSupabaseData(
  role: BootstrapRole = 'employee',
  options?: BootstrapOptions,
  runOptions?: BootstrapRunOptions,
): Promise<void> {
  await bootstrapEssential(role, options, runOptions);
  await bootstrapDeferred(role, options, runOptions);
}
