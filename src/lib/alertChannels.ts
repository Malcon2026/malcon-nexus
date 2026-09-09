import { startCaseAlertEscalation } from './caseAlerts';

/** Alert 1, 2, 3 — all via Telegram (+15m, +30m). Stops after 3 or when acknowledged. */
export function notifyAssignmentAlerts(caseId: string, employeeId: string | undefined | null): void {
  startCaseAlertEscalation(caseId, employeeId, 'assignment');
}

/** Same 3-step ladder for postpone. */
export function notifyPostponeAlerts(caseId: string, employeeId: string | undefined | null): void {
  startCaseAlertEscalation(caseId, employeeId, 'postpone');
}
