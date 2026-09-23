import { notifyCaseAssignment } from './email';
import { startCaseAlertEscalation } from './caseAlerts';

/** Email + Telegram Alert 1 (and escalation ladder) for one assignee. */
export function notifyCaseAssignmentToEmployee(
  caseId: string,
  employeeId: string | undefined | null,
): void {
  if (!employeeId) return;
  void notifyCaseAssignment(caseId, employeeId);
  startCaseAlertEscalation(caseId, employeeId, 'assignment');
}

/** Notify each distinct employee (kit prep, delivery, surgery, return, etc.). */
export function notifyCaseAssignmentsToEmployees(
  caseId: string,
  employeeIds: Iterable<string | undefined | null>,
): void {
  const seen = new Set<string>();
  for (const id of employeeIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    notifyCaseAssignmentToEmployee(caseId, id);
  }
}

/** @deprecated use notifyCaseAssignmentToEmployee */
export function notifyAssignmentAlerts(caseId: string, employeeId: string | undefined | null): void {
  startCaseAlertEscalation(caseId, employeeId, 'assignment');
}

/** Same 3-step ladder for postpone. */
export function notifyPostponeAlerts(caseId: string, employeeId: string | undefined | null): void {
  startCaseAlertEscalation(caseId, employeeId, 'postpone');
}
