import type { Employee } from '../types';

export type AppViewMode = 'admin' | 'employee' | 'petrol' | 'store_manager';

export type BootstrapRole = 'admin' | 'employee' | 'petrol' | 'store_manager';

export const KIT_PREPARATION_STAGE = 'Kit Preparation';

export function viewModeForRole(role: Employee['role']): AppViewMode {
  if (role === 'admin') return 'admin';
  if (role === 'petrol') return 'petrol';
  if (role === 'store_manager') return 'store_manager';
  return 'employee';
}

export function bootstrapRoleForEmployee(role: Employee['role']): BootstrapRole {
  if (role === 'admin') return 'admin';
  if (role === 'petrol') return 'petrol';
  if (role === 'store_manager') return 'store_manager';
  return 'employee';
}

export function isFullAdmin(role: Employee['role']): boolean {
  return role === 'admin';
}

export function isStoreManager(role: Employee['role']): boolean {
  return role === 'store_manager';
}

export function isKitPreparationStage(stage: string): boolean {
  const normalized = stage.replace(/\s+/g, ' ').trim();
  return normalized === KIT_PREPARATION_STAGE;
}

/** Create cases, assign team, edit case board (Stores lead). */
export function canManageCaseBoard(role: Employee['role']): boolean {
  return role === 'admin' || role === 'store_manager';
}

/** @deprecated Use canManageCaseBoard — kept for call sites. */
export function canManageAllCases(role: Employee['role']): boolean {
  return canManageCaseBoard(role);
}

export function isCaseOpsView(viewMode: AppViewMode): boolean {
  return viewMode === 'admin' || viewMode === 'store_manager';
}

/** Uses Employee ID + Telegram OTP (not email admin login). */
export function usesEmployeeSignIn(role: Employee['role']): boolean {
  return role === 'employee' || role === 'store_manager';
}

/** Stage submit + photos: admin any stage; store manager Kit Preparation only. */
export function canBypassAssigneeForSubmit(role: Employee['role'], currentStage: string): boolean {
  if (role === 'admin') return true;
  if (role === 'store_manager') return isKitPreparationStage(currentStage);
  return false;
}

export function activityLogRole(role: Employee['role']): 'admin' | 'employee' {
  return role === 'admin' ? 'admin' : 'employee';
}
