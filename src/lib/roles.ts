import type { Employee, ImplantCase } from '../types';
import { findStageRecord, isCaseAssignedToEmployee } from './caseWorkflow';

export type AppViewMode = 'admin' | 'employee' | 'petrol' | 'store_manager';

export type BootstrapRole = 'admin' | 'employee' | 'petrol' | 'store_manager';

export const SET_PREPARATION_STAGE = 'Set Preparation';

/** Legacy value in older rows — treated as set preparation. */
export const LEGACY_KIT_PREPARATION_STAGE = 'Kit Preparation';

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

/** View team register and mark attendance (not full admin). */
export function canManageTeamAttendance(role: Employee['role']): boolean {
  return role === 'admin' || role === 'store_manager';
}

export function isStoreManager(role: Employee['role']): boolean {
  return role === 'store_manager';
}

export function isSetPreparationStage(stage: string): boolean {
  const normalized = stage.replace(/\s+/g, ' ').trim();
  return normalized === SET_PREPARATION_STAGE || normalized === LEGACY_KIT_PREPARATION_STAGE;
}

/** @deprecated Use isSetPreparationStage */
export const isKitPreparationStage = isSetPreparationStage;

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

/** Stage submit + photos: admin any stage; store manager may bypass assignee check at Set Preparation only. */
export function canBypassAssigneeForSubmit(role: Employee['role'], currentStage: string): boolean {
  if (role === 'admin') return true;
  if (role === 'store_manager') return isSetPreparationStage(currentStage);
  return false;
}

/** Store lead finished preparing the set — upload photos and advance to Delivery. */
export function canStoreManagerSubmitSetPreparation(
  implantCase: ImplantCase,
  user: Pick<Employee, 'id' | 'email' | 'role'>,
): boolean {
  if (user.role !== 'store_manager') return false;
  if (!isSetPreparationStage(implantCase.currentStage)) return false;
  if (
    implantCase.status === 'Waiting For Approval' ||
    implantCase.status === 'Completed' ||
    implantCase.status === 'Cancelled'
  ) {
    return false;
  }
  const prep = findStageRecord(implantCase.stages, 'Set Preparation');
  if (prep?.status === 'Submitted' || prep?.status === 'Approved') return false;

  if (isCaseAssignedToEmployee(implantCase, user)) return true;
  if (prep?.assignedEmployee && isCaseAssignedToEmployee({ ...implantCase, assignedEmployee: prep.assignedEmployee }, user)) {
    return true;
  }
  return canBypassAssigneeForSubmit(user.role, implantCase.currentStage);
}

export function activityLogRole(role: Employee['role']): 'admin' | 'employee' {
  return role === 'admin' ? 'admin' : 'employee';
}
