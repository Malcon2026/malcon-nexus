import type { CaseTaskRequest, ImplantCase } from '../types';
import {
  canRequestTaskCase,
  getAvailablePoolCases,
  isFcfsPoolCase,
  type FcfsStage,
} from './caseWorkflow';

export function isPendingTaskRequest(r: CaseTaskRequest): boolean {
  return r.status === 'pending';
}

export function getPendingTaskRequests(requests: CaseTaskRequest[]): CaseTaskRequest[] {
  return requests.filter(isPendingTaskRequest);
}

export function getPendingTaskRequestsForCase(
  requests: CaseTaskRequest[],
  caseId: string,
): CaseTaskRequest[] {
  return getPendingTaskRequests(requests).filter((r) => r.caseId === caseId);
}

export function hasEmployeePendingTaskRequest(
  requests: CaseTaskRequest[],
  caseId: string,
  employeeId: string,
): boolean {
  return getPendingTaskRequests(requests).some(
    (r) => r.caseId === caseId && r.employeeId === employeeId,
  );
}

export function getMyPendingTaskRequests(
  requests: CaseTaskRequest[],
  employeeId: string,
): CaseTaskRequest[] {
  return getPendingTaskRequests(requests)
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
}

/** Pool cases the employee can still request (not already pending). */
export function getPoolCasesAvailableToRequest(
  cases: ImplantCase[],
  requests: CaseTaskRequest[],
  employee: Pick<import('../types').Employee, 'id' | 'email' | 'department'>,
): ImplantCase[] {
  return getAvailablePoolCases(cases, employee).filter(
    (c) => !hasEmployeePendingTaskRequest(requests, c.id, employee.id),
  );
}

export function canEmployeeRequestTask(
  c: ImplantCase,
  requests: CaseTaskRequest[],
  employee: Pick<import('../types').Employee, 'id' | 'email' | 'department'>,
): boolean {
  if (!canRequestTaskCase(c, employee)) return false;
  return !hasEmployeePendingTaskRequest(requests, c.id, employee.id);
}

export function countPendingTaskRequests(requests: CaseTaskRequest[]): number {
  return getPendingTaskRequests(requests).length;
}

export function countCasesWithPendingRequests(requests: CaseTaskRequest[]): number {
  return new Set(getPendingTaskRequests(requests).map((r) => r.caseId)).size;
}

export function groupPendingRequestsByCase(
  requests: CaseTaskRequest[],
): Map<string, CaseTaskRequest[]> {
  const map = new Map<string, CaseTaskRequest[]>();
  for (const r of getPendingTaskRequests(requests)) {
    const list = map.get(r.caseId) ?? [];
    list.push(r);
    map.set(r.caseId, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  }
  return map;
}

export function poolStageLabel(stage: FcfsStage): string {
  if (stage === 'Pickup from Hospital') return 'RTD pickup';
  return stage;
}

export { isFcfsPoolCase };
