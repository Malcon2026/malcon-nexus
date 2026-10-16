import { supabaseStorage } from './storage';
import {
  sbEmployeeRepo,
  sbHospitalRepo,
  sbDoctorRepo,
  sbCaseRepo,
  sbCaseTaskRequestRepo,
  sbNotificationRepo,
  sbApprovalRepo,
  sbActivityRepo,
  sbDepartmentRepo,
  sbKitRepo,
  sbAttendanceRepo,
  sbAttendanceApprovalRepo,
  sbFieldTeamAttendanceRepo,
  sbLeaveRepo,
  sbPetrolRepo,
  sbLocationTripRepo,
  sbFoodRepo,
} from './repositories/supabaseRepositories';
import { FCFS_POOL_ENABLED } from '../caseWorkflow';
import { USE_CLOUDFLARE_BACKEND } from '../cloudflareConfig';
import { ADMIN_BACKGROUND_CASE_CAP } from '../workerApi';
import { getISTDateKey, getISTDayStartIso } from '../attendance';
import { foodLoadWindow } from '../food';
import { NOTIFICATION_BOOTSTRAP_CAP_STAGE1 } from '../workerApi';
import { mergeCasesIntoCache } from '../liveDataSync';
import type { ImplantCase } from '../../types';

import type { BootstrapRole } from '../roles';
import {
  BOOTSTRAP_CACHE_TTL_MS,
  isBootstrapCacheFresh as isSessionCacheFresh,
  restoreBootstrapCacheForDisplay,
  writeBootstrapCachePayload,
  type BootstrapCachePayload,
} from '../bootstrapSessionCache';

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
  /** Employee login replaces case list; admin/store merges so capped sync cannot drop today. */
  casesSeed?: 'merge' | 'replace';
}

const ATTENDANCE_LOOKBACK_DAYS = 150;

function getAttendanceSinceIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getAttendanceBootstrapSinceIso(): string {
  return getAttendanceSinceIso(ATTENDANCE_LOOKBACK_DAYS);
}

function todayBootstrapContext() {
  const dateKey = getISTDateKey();
  return { dateKey, dayStartIso: getISTDayStartIso(dateKey) };
}

function employeeCasesTask(employeeId: string): BootstrapTask {
  return {
    key: 'cases',
    casesSeed: 'replace',
    run: async () => {
      const self = await sbEmployeeRepo.getById(employeeId);
      if (!self) return [];
      return sbCaseRepo.getCasesForEmployeeIncludingPool(employeeId, self);
    },
  };
}

/** Stage 1 — employees + today's operational data only (fast login). */
function stage1Tasks(role: BootstrapRole, options?: BootstrapOptions): BootstrapTask[] {
  const { dateKey, dayStartIso } = todayBootstrapContext();
  const notifyCap = { cap: NOTIFICATION_BOOTSTRAP_CAP_STAGE1 };

  if (role === 'admin') {
    return [
      { key: 'employees', run: () => sbEmployeeRepo.getAll() },
      { key: 'departments', run: () => sbDepartmentRepo.getAll() },
      { key: 'notifications', run: () => sbNotificationRepo.getAll(undefined, notifyCap) },
      { key: 'cases', casesSeed: 'merge', run: () => sbCaseRepo.getForBootstrapDay(dateKey, dayStartIso) },
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentSince(dayStartIso) },
      {
        key: 'foodSelections',
        run: () => {
          const { from, to } = foodLoadWindow(dateKey);
          return sbFoodRepo.getForDateRange(from, to);
        },
      },
      { key: 'fieldTeamAttendanceApprovals', run: () => sbFieldTeamAttendanceRepo.getForDate(dateKey) },
    ];
  }

  if (role === 'store_manager' && options?.employeeId) {
    return [
      { key: 'employees', run: () => sbEmployeeRepo.getAll() },
      { key: 'notifications', run: () => sbNotificationRepo.getAll(undefined, notifyCap) },
      { key: 'cases', casesSeed: 'merge', run: () => sbCaseRepo.getForBootstrapDay(dateKey, dayStartIso) },
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentSince(dayStartIso) },
      { key: 'departments', run: () => sbDepartmentRepo.getAll() },
    ];
  }

  if (role === 'employee' && options?.employeeId) {
    const employeeId = options.employeeId;
    return [
      {
        key: 'employees',
        run: async () => {
          const self = await sbEmployeeRepo.getById(employeeId);
          return self ? [self] : [];
        },
      },
      { key: 'notifications', run: () => sbNotificationRepo.getAll(employeeId, notifyCap) },
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentForEmployee(employeeId, dayStartIso) },
      employeeCasesTask(employeeId),
    ];
  }

  if (role === 'petrol' && options?.employeeId) {
    return [
      { key: 'employees', run: () => sbEmployeeRepo.getAll() },
      { key: 'petrolRequests', run: () => sbPetrolRepo.getAll() },
    ];
  }

  return [];
}

/** Stage 2 — full history and reference data (background after shell is usable). */
function stage2Tasks(role: BootstrapRole, options?: BootstrapOptions): BootstrapTask[] {
  const { dateKey } = todayBootstrapContext();
  const attendanceSinceIso = getAttendanceBootstrapSinceIso();

  if (role === 'admin') {
    return [
      {
        key: 'cases',
        casesSeed: 'merge',
        run: () =>
          USE_CLOUDFLARE_BACKEND
            ? sbCaseRepo.getAll({ cap: ADMIN_BACKGROUND_CASE_CAP })
            : sbCaseRepo.getAll(),
      },
      { key: 'notifications', run: () => sbNotificationRepo.getAll() },
      { key: 'hospitals', run: () => sbHospitalRepo.getAll() },
      { key: 'doctors', run: () => sbDoctorRepo.getAll() },
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentSince(attendanceSinceIso) },
      { key: 'attendanceApprovalRequests', run: () => sbAttendanceApprovalRepo.getAll() },
      { key: 'fieldTeamAttendanceApprovals', run: () => sbFieldTeamAttendanceRepo.getAll() },
      { key: 'leaveRequests', run: () => sbLeaveRepo.getAll() },
      { key: 'petrolRequests', run: () => sbPetrolRepo.getAll() },
      {
        key: 'foodSelections',
        run: () => {
          const { from, to } = foodLoadWindow(dateKey);
          return sbFoodRepo.getForDateRange(from, to);
        },
      },
      { key: 'locationTrips', run: () => sbLocationTripRepo.getAll() },
      { key: 'approvals', run: () => sbApprovalRepo.getAll() },
      { key: 'caseTaskRequests', run: () => (FCFS_POOL_ENABLED ? sbCaseTaskRequestRepo.getAll() : Promise.resolve([])) },
      { key: 'kits', run: () => sbKitRepo.getAll() },
      { key: 'activityLog', run: () => sbActivityRepo.getAll() },
    ];
  }

  if (role === 'store_manager' && options?.employeeId) {
    const employeeId = options.employeeId;
    return [
      {
        key: 'cases',
        casesSeed: 'merge',
        run: () =>
          USE_CLOUDFLARE_BACKEND
            ? sbCaseRepo.getAll({ cap: ADMIN_BACKGROUND_CASE_CAP })
            : sbCaseRepo.getAll(),
      },
      { key: 'notifications', run: () => sbNotificationRepo.getAll() },
      { key: 'hospitals', run: () => sbHospitalRepo.getAll() },
      { key: 'doctors', run: () => sbDoctorRepo.getAll() },
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getAll() },
      { key: 'leaveRequests', run: () => sbLeaveRepo.getAll() },
      { key: 'attendanceApprovalRequests', run: () => sbAttendanceApprovalRepo.getAll() },
      { key: 'approvals', run: () => sbApprovalRepo.getAll() },
      { key: 'caseTaskRequests', run: () => (FCFS_POOL_ENABLED ? sbCaseTaskRequestRepo.getAll() : Promise.resolve([])) },
      { key: 'kits', run: () => sbKitRepo.getAll() },
      { key: 'locationTrips', run: () => sbLocationTripRepo.getForEmployee(employeeId) },
      { key: 'petrolRequests', run: () => sbPetrolRepo.getForEmployee(employeeId) },
      { key: 'foodSelections', run: () => sbFoodRepo.getForEmployee(employeeId) },
    ];
  }

  if (role === 'employee' && options?.employeeId) {
    const employeeId = options.employeeId;
    return [
      { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentForEmployee(employeeId, attendanceSinceIso) },
      { key: 'leaveRequests', run: () => sbLeaveRepo.getForEmployee(employeeId) },
      { key: 'petrolRequests', run: () => sbPetrolRepo.getForEmployee(employeeId) },
      { key: 'foodSelections', run: () => sbFoodRepo.getForEmployee(employeeId) },
      { key: 'hospitals', run: () => sbHospitalRepo.getAll() },
      { key: 'locationTrips', run: () => sbLocationTripRepo.getForEmployee(employeeId) },
      { key: 'departments', run: () => sbDepartmentRepo.getAll() },
      {
        key: 'attendanceApprovalRequests',
        run: () => sbAttendanceApprovalRepo.getForEmployee(employeeId),
      },
      { key: 'caseTaskRequests', run: () => (FCFS_POOL_ENABLED ? sbCaseTaskRequestRepo.getForEmployee(employeeId) : Promise.resolve([])) },
      { key: 'notifications', run: () => sbNotificationRepo.getAll(employeeId) },
    ];
  }

  return [];
}

function shouldSkipEssentialFetch(
  role: BootstrapRole,
  options: BootstrapOptions | undefined,
  runOptions?: BootstrapRunOptions,
): boolean {
  if (runOptions?.force) return false;
  if (role === 'petrol') return false;
  if (!options?.employeeId) return false;
  return isSessionCacheFresh(options.employeeId, BOOTSTRAP_CACHE_TTL_MS);
}

/** Avoid dozens of simultaneous API calls during login (RDS allows more than D1). */
const BOOTSTRAP_TASK_CONCURRENCY = USE_CLOUDFLARE_BACKEND ? 8 : 4;

async function runBootstrapTasks(tasks: BootstrapTask[], tier: string): Promise<void> {
  if (!supabaseStorage || tasks.length === 0) return;

  const startedAt = performance.now();
  const results: PromiseSettledResult<{ value: unknown; ms: number }>[] = [];

  for (let i = 0; i < tasks.length; i += BOOTSTRAP_TASK_CONCURRENCY) {
    const slice = tasks.slice(i, i + BOOTSTRAP_TASK_CONCURRENCY);
    const timedTasks = slice.map((t) => {
      const taskStart = performance.now();
      return t.run().then(
        (value) => ({ value, ms: performance.now() - taskStart }),
        (reason) => Promise.reject({ reason, ms: performance.now() - taskStart }),
      );
    });
    const batch = await Promise.allSettled(timedTasks);
    results.push(...batch);
  }

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
    const task = tasks[i];
    if (key === 'cases' && task.casesSeed !== 'replace') {
      mergeCasesIntoCache(value as ImplantCase[]);
    } else {
      supabaseStorage!.seedCache(key, value as unknown[]);
    }
  });

  console.info(
    `[perf] bootstrap ${tier} finished in ${Math.round(performance.now() - startedAt)}ms` +
      (slowestKey ? ` (slowest: ${slowestKey} ${Math.round(slowestMs)}ms)` : ''),
  );
}

/** True when session cache exists and is within TTL. */
export function isBootstrapCacheFresh(employeeId: string): boolean {
  return isSessionCacheFresh(employeeId, BOOTSTRAP_CACHE_TTL_MS);
}

/** Restore last session cache so the UI can render immediately on reopen. */
export function restoreBootstrapCache(employeeId: string): boolean {
  return restoreBootstrapCacheForDisplay(employeeId);
}

/** Load every case row into session cache (admin / store manager history). */
export async function refreshFullCaseCatalog(): Promise<void> {
  if (!supabaseStorage) return;
  try {
    const rows = await sbCaseRepo.getAll();
    mergeCasesIntoCache(rows);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('malcon-bootstrap-updated'));
    }
  } catch (err) {
    console.warn('[bootstrap] full case catalog refresh failed:', err);
  }
}

/** Persist loaded collections for fast next open in the same browser session. */
export function persistBootstrapCache(
  employeeId: string,
  role: BootstrapRole,
  options?: { omitCases?: boolean },
): void {
  if (!supabaseStorage || typeof sessionStorage === 'undefined') return;

  const keys =
    role === 'admin'
      ? [
          'cases',
          'notifications',
          'attendanceRecords',
          'attendanceApprovalRequests',
          'leaveRequests',
          'petrolRequests',
          'foodSelections',
          'locationTrips',
          'departments',
          'employees',
          'hospitals',
          'doctors',
          'approvals',
          'caseTaskRequests',
          'fieldTeamAttendanceApprovals',
          'kits',
          'activityLog',
        ]
      : role === 'petrol'
        ? ['employees', 'petrolRequests']
        : role === 'store_manager'
          ? [
              'employees',
              'attendanceRecords',
              'leaveRequests',
              'petrolRequests',
              'foodSelections',
              'locationTrips',
              'attendanceApprovalRequests',
              'cases',
              'caseTaskRequests',
              'notifications',
              'hospitals',
              'doctors',
              'departments',
              'approvals',
              'kits',
            ]
      : [
          'employees',
          'attendanceRecords',
          'leaveRequests',
          'petrolRequests',
          'foodSelections',
          'locationTrips',
          'attendanceApprovalRequests',
          'departments',
          'cases',
          'caseTaskRequests',
          'notifications',
          'hospitals',
        ];

  const data: Record<string, unknown[]> = {};
  for (const key of keys) {
    if (options?.omitCases && key === 'cases') continue;
    const value = supabaseStorage.getItem<unknown[]>(key);
    if (value) data[key] = value;
  }

  writeBootstrapCachePayload(employeeId, { savedAt: Date.now(), data });
}

/** Fresh fetch for admin approval queues (leave + off-site punch). */
export async function refreshApprovalQueues(): Promise<void> {
  await runBootstrapTasks(
    [
      { key: 'leaveRequests', run: () => sbLeaveRepo.getAll() },
      { key: 'petrolRequests', run: () => sbPetrolRepo.getAll() },
      { key: 'attendanceApprovalRequests', run: () => sbAttendanceApprovalRepo.getAll() },
      { key: 'fieldTeamAttendanceApprovals', run: () => sbFieldTeamAttendanceRepo.getAll() },
      { key: 'caseTaskRequests', run: () => (FCFS_POOL_ENABLED ? sbCaseTaskRequestRepo.getAll() : Promise.resolve([])) },
    ],
    'approvals',
  );
}

/** Load data needed for the first interactive screen (attendance, leave). Returns false when skipped (fresh cache). */
export async function bootstrapEssential(
  role: BootstrapRole,
  options?: BootstrapOptions,
  runOptions?: BootstrapRunOptions,
): Promise<boolean> {
  if (shouldSkipEssentialFetch(role, options, runOptions)) {
    // Session cache is from login time and does not include punches made later.
    // Always re-read location trips so refresh does not wipe them.
    if ((role === 'employee' || role === 'store_manager') && options?.employeeId) {
      const employeeId = options.employeeId;
      const { dateKey, dayStartIso } = todayBootstrapContext();
      const refreshTasks: BootstrapTask[] = [
        { key: 'locationTrips', run: () => sbLocationTripRepo.getForEmployee(employeeId) },
        { key: 'attendanceRecords', run: () => sbAttendanceRepo.getRecentForEmployee(employeeId, dayStartIso) },
        {
          key: 'foodSelections',
          run: () => {
            const { from, to } = foodLoadWindow(dateKey);
            return sbFoodRepo.getForDateRange(from, to);
          },
        },
      ];
      const cachedCases = supabaseStorage?.getItem<unknown[]>('cases');
      if (!Array.isArray(cachedCases) || cachedCases.length === 0) {
        refreshTasks.push(employeeCasesTask(employeeId));
      }
      await runBootstrapTasks(refreshTasks, 'employee-refresh');
      return true;
    }
    if (role === 'admin' || role === 'store_manager') {
      void refreshApprovalQueues().then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('malcon-bootstrap-updated'));
        }
      });
      void refreshFullCaseCatalog();
    }
    return false;
  }

  await runBootstrapTasks(stage1Tasks(role, options), 'stage-1');
  return true;
}

/** Stage 2 — full datasets after login (see `stage2Tasks`). */
export async function bootstrapDeferred(
  role: BootstrapRole,
  options?: BootstrapOptions,
  _runOptions?: BootstrapRunOptions,
): Promise<void> {
  await runBootstrapTasks(stage2Tasks(role, options), 'stage-2');
  if (role === 'admin' || role === 'store_manager') {
    const { refreshLiveWorkspaceData } = await import('../liveDataSync');
    await refreshLiveWorkspaceData(role, options?.employeeId ? { employeeId: options.employeeId } : undefined);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('malcon-bootstrap-updated'));
  }
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
