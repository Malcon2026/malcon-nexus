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
} from './repositories/supabaseRepositories';

/** Load all collections from Supabase into the in-memory cache (Supabase mode only). */
export async function bootstrapSupabaseData(): Promise<void> {
  if (!supabaseStorage) return;

  const results = await Promise.allSettled([
    sbEmployeeRepo.getAll(),
    sbHospitalRepo.getAll(),
    sbDoctorRepo.getAll(),
    sbCaseRepo.getAll(),
    sbNotificationRepo.getAll(),
    sbDepartmentRepo.getAll(),
    sbKitRepo.getAll(),
    sbActivityRepo.getAll(),
    sbApprovalRepo.getAll(),
  ]);

  const [
    employees,
    hospitals,
    doctors,
    cases,
    notifications,
    departments,
    kits,
    activityLog,
    approvals,
  ] = results.map((r, i) => {
    if (r.status === 'rejected') {
      const keys = ['employees', 'hospitals', 'doctors', 'cases', 'notifications', 'departments', 'kits', 'activityLog', 'approvals'];
      console.warn(`[bootstrap] Failed to load ${keys[i]}:`, r.reason);
      return [];
    }
    return r.value;
  });

  supabaseStorage.seedCache('employees', employees);
  supabaseStorage.seedCache('hospitals', hospitals);
  supabaseStorage.seedCache('doctors', doctors);
  supabaseStorage.seedCache('cases', cases);
  supabaseStorage.seedCache('notifications', notifications);
  supabaseStorage.seedCache('departments', departments);
  supabaseStorage.seedCache('kits', kits);
  supabaseStorage.seedCache('activityLog', activityLog);
  supabaseStorage.seedCache('approvals', approvals);
}
