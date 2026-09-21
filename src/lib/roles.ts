import type { Employee } from '../types';

export type AppViewMode = 'admin' | 'employee' | 'petrol' | 'store_manager';

export type BootstrapRole = 'admin' | 'employee' | 'petrol' | 'store_manager';

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

/** Full case CRUD: create, assign all stages, workflow (not full Nexus admin). */
export function canManageAllCases(role: Employee['role']): boolean {
  return role === 'admin' || role === 'store_manager';
}

export function isCaseOpsView(viewMode: AppViewMode): boolean {
  return viewMode === 'admin' || viewMode === 'store_manager';
}

/** Uses Employee ID + Telegram OTP (not email admin login). */
export function usesEmployeeSignIn(role: Employee['role']): boolean {
  return role === 'employee' || role === 'store_manager';
}

export function activityLogRole(role: Employee['role']): 'admin' | 'employee' {
  return canManageAllCases(role) ? 'admin' : 'employee';
}
