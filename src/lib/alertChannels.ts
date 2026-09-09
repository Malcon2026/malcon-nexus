import { startCaseAlertEscalation } from './caseAlerts';

/** Alert 1 now (Telegram); Alert 2 (+15m push); Alert 3 (+30m Telegram). Stops after 3 or when acknowledged. */
export function notifyAssignmentAlerts(caseId: string, employeeId: string | undefined | null): void {
  startCaseAlertEscalation(caseId, employeeId, 'assignment');
}

/** Same 3-step ladder for postpone. */
export function notifyPostponeAlerts(caseId: string, employeeId: string | undefined | null): void {
  startCaseAlertEscalation(caseId, employeeId, 'postpone');
}
