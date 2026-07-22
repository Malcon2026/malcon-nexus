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

interface BootstrapTask {
  key: string;
  run: () => Promise<unknown>;
}

const CACHE_PREFIX = 'malcon-nexus-bootstrap-v1';
const ATTENDANCE_LOOKBACK_DAYS = 150;

function getAttendanceBootstrapSinceIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - ATTENDANCE_LOOKBACK_DAYS);
  return date.toISOString();
}

function cacheKey(employeeId: string): string {
  return `${CACHE_PREFIX}:${employeeId}`;
}

function employeeEssentialTasks(employeeId: string): BootstrapTask[] {
  const sinceIso = getAttendanceBootstrapSinceIso();
  return [
    {
      key: 'attendanceRecords',
      run: () => sbAttendanceRepo.getRecentForEmployee(employeeId, sinceIso),
    },
    { key: 'leaveRequests', run: () => sbLeaveRepo.getForEmployee(employeeId) },
    {
      key: 'attendanceApprovalRequests',
      run: () => sbAttendanceApprovalRepo.getForEmployee(employeeId),
    },
    { key: 'departments', run: () => sbDepartmentRepo.getAll() },
  ];
}

function employeeDeferredTasks(): BootstrapTask[] {
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
      : employeeDeferredTasks();
  }

  return tier === 'essential' ? adminEssentialTasks() : adminDeferredTasks();
}

async function runBootstrapTasks(tasks: BootstrapTask[]): Promise<void> {
  if (!supabaseStorage || tasks.length === 0) return;

  const results = await Promise.allSettled(tasks.map((t) => t.run()));

  results.forEach((result, i) => {
    const key = tasks[i].key;
    if (result.status === 'rejected') {
      console.warn(`[bootstrap] Failed to load ${key}:`, result.reason);
      return;
    }
    supabaseStorage!.seedCache(key, result.value as unknown[]);
  });
}

/** Restore last session cache so the UI can render immediately on reopen. */
export function restoreBootstrapCache(employeeId: string): boolean {
  if (!supabaseStorage || typeof sessionStorage === 'undefined') return false;

  try {
    const raw = sessionStorage.getItem(cacheKey(employeeId));
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { data?: Record<string, unknown[]> };
    if (!parsed.data) return false;

    for (const [key, value] of Object.entries(parsed.data)) {
      supabaseStorage.seedCache(key, value);
    }
    return true;
  } catch {
    return false;
  }
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

/** Load data needed for the first interactive screen (attendance, leave). */
export async function bootstrapEssential(
  role: BootstrapRole,
  options?: BootstrapOptions,
): Promise<void> {
  await runBootstrapTasks(tasksFor(role, 'essential', options));
}

/** Load heavier collections after the shell is visible. */
export async function bootstrapDeferred(
  role: BootstrapRole,
  options?: BootstrapOptions,
): Promise<void> {
  await runBootstrapTasks(tasksFor(role, 'deferred', options));
}

/** Full bootstrap — used after login and manual refresh. */
export async function bootstrapSupabaseData(
  role: BootstrapRole = 'employee',
  options?: BootstrapOptions,
): Promise<void> {
  await bootstrapEssential(role, options);
  await bootstrapDeferred(role, options);
}
