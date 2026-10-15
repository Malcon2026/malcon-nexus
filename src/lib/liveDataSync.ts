import { getISTDateKey, getISTDayStartIso } from './attendance';
import {
  sbApprovalRepo,
  sbCaseRepo,
  sbEmployeeRepo,
  sbNotificationRepo,
} from './database/repositories/supabaseRepositories';
import { supabaseStorage } from './database/storage';
import { NOTIFICATION_BOOTSTRAP_CAP_STAGE1 } from './workerApi';
import type { BootstrapRole } from './roles';
import type { ImplantCase } from '../types';

/** How often open tabs poll for case stage moves (no Supabase Realtime on AWS). */
export const LIVE_DATA_POLL_MS = 20_000;

function mergeCasesIntoCache(incoming: ImplantCase[]): void {
  if (!supabaseStorage || incoming.length === 0) return;
  const existing = (supabaseStorage.getItem('cases') ?? []) as ImplantCase[];
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) byId.set(c.id, c);
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  supabaseStorage.seedCache('cases', merged);
}

/**
 * Lightweight poll: today's cases (or employee scope) + small notification slice.
 * Merges into session cache so cards move without full bootstrap / page reload.
 */
export async function refreshLiveWorkspaceData(
  role: BootstrapRole,
  options?: { employeeId?: string },
): Promise<void> {
  if (!supabaseStorage) return;

  const dateKey = getISTDateKey();
  const dayStartIso = getISTDayStartIso(dateKey);

  if (role === 'employee' && options?.employeeId) {
    const self = await sbEmployeeRepo.getById(options.employeeId);
    if (!self) return;
    const cases = await sbCaseRepo.getCasesForEmployeeIncludingPool(options.employeeId, self);
    mergeCasesIntoCache(cases);
    const notifications = await sbNotificationRepo.getAll(options.employeeId, {
      cap: NOTIFICATION_BOOTSTRAP_CAP_STAGE1,
    });
    supabaseStorage.seedCache('notifications', notifications);
    return;
  }

  if (role === 'admin' || role === 'store_manager') {
    const cases = await sbCaseRepo.getForBootstrapDay(dateKey, dayStartIso);
    mergeCasesIntoCache(cases);
    const notifications = await sbNotificationRepo.getAll(undefined, {
      cap: NOTIFICATION_BOOTSTRAP_CAP_STAGE1,
    });
    supabaseStorage.seedCache('notifications', notifications);
    if (role === 'admin') {
      const approvals = await sbApprovalRepo.getAll();
      supabaseStorage.seedCache('approvals', approvals);
    }
  }
}
