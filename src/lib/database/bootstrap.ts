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
} from './repositories/supabaseRepositories';

type BootstrapRole = 'admin' | 'employee';
type BootstrapTier = 'essential' | 'full';

interface BootstrapTask {
  key: string;
  run: () => Promise<unknown>;
}

function tasksFor(role: BootstrapRole, tier: BootstrapTier): BootstrapTask[] {
  const tasks: BootstrapTask[] = [
    { key: 'cases', run: () => sbCaseRepo.getAll() },
    { key: 'notifications', run: () => sbNotificationRepo.getAll() },
    { key: 'attendanceRecords', run: () => sbAttendanceRepo.getAll() },
    { key: 'attendanceApprovalRequests', run: () => sbAttendanceApprovalRepo.getAll() },
    { key: 'departments', run: () => sbDepartmentRepo.getAll() },
  ];

  if (role === 'admin') {
    tasks.push(
      { key: 'employees', run: () => sbEmployeeRepo.getAll() },
      { key: 'hospitals', run: () => sbHospitalRepo.getAll() },
      { key: 'doctors', run: () => sbDoctorRepo.getAll() },
      { key: 'approvals', run: () => sbApprovalRepo.getAll() },
    );
    if (tier === 'full') {
      tasks.push(
        { key: 'kits', run: () => sbKitRepo.getAll() },
        { key: 'activityLog', run: () => sbActivityRepo.getAll() },
      );
    }
  }

  return tasks;
}

async function runBootstrapTasks(tasks: BootstrapTask[]): Promise<void> {
  if (!supabaseStorage) return;

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

/** Load data needed to render the app shell and primary views. */
export async function bootstrapEssential(role: BootstrapRole): Promise<void> {
  await runBootstrapTasks(tasksFor(role, 'essential'));
}

/** Load heavier admin collections (activity log, kits) in the background. */
export async function bootstrapDeferred(role: BootstrapRole): Promise<void> {
  if (role !== 'admin') return;
  await runBootstrapTasks(tasksFor(role, 'full').filter((t) => t.key === 'kits' || t.key === 'activityLog'));
}

/** Full bootstrap — used after login and manual refresh. */
export async function bootstrapSupabaseData(role: BootstrapRole = 'employee'): Promise<void> {
  await bootstrapEssential(role);
  await bootstrapDeferred(role);
}
