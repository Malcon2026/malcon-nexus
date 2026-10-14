import type {
  ActivityEvent,
  Approval,
  CaseTaskRequest,
  Employee,
  ImplantCase,
} from '../types';
import {
  STAGE_DEPARTMENT_MAP,
  fcfsStagesForEmployee,
  normalizeWorkflowStageName,
} from './caseWorkflow';
import { getCaseDetailsByIds, getEmployeeCaseIdsViaWorker, getFcfsPoolListViaWorker } from './workerApi';
import {
  workerActivityToApp,
  workerApprovalToApp,
  workerCaseTaskRequestToApp,
} from './workerReadMappers';
import {
  getAllActivityLogViaWorker,
  getAllApprovalsViaWorker,
  getCaseTaskRequestsViaWorker,
} from './workerApi';

async function caseDetailsToImplantCases(details: Record<string, unknown>[]): Promise<ImplantCase[]> {
  const { caseRowToImplantCase } = await import('./database/repositories/supabaseRepositories');
  const { workerCaseDetailToPgRow } = await import('./workerReadMappers');
  return details.map((d) => caseRowToImplantCase(workerCaseDetailToPgRow(d)));
}

export async function fetchApprovalsFromWorker(): Promise<Approval[]> {
  const rows = await getAllApprovalsViaWorker();
  return rows.map(workerApprovalToApp);
}

export async function fetchActivityFromWorker(): Promise<ActivityEvent[]> {
  const rows = await getAllActivityLogViaWorker();
  return rows.map(workerActivityToApp);
}

export async function fetchAllCaseTaskRequestsFromWorker(): Promise<CaseTaskRequest[]> {
  const rows = await getCaseTaskRequestsViaWorker({});
  return rows.map(workerCaseTaskRequestToApp);
}

export async function fetchCaseTaskRequestsForEmployeeFromWorker(employeeId: string): Promise<CaseTaskRequest[]> {
  const rows = await getCaseTaskRequestsViaWorker({ employeeId });
  return rows.map(workerCaseTaskRequestToApp);
}

export async function fetchPendingCaseTaskRequestsForCaseFromWorker(caseId: string): Promise<CaseTaskRequest[]> {
  const rows = await getCaseTaskRequestsViaWorker({ caseId, status: 'pending' });
  return rows.map(workerCaseTaskRequestToApp);
}

export async function fetchCasesForEmployeeFromWorker(employeeId: string): Promise<ImplantCase[]> {
  const ids = await getEmployeeCaseIdsViaWorker(employeeId);
  const details = await getCaseDetailsByIds(ids);
  return caseDetailsToImplantCases(details);
}

export async function fetchFcfsPoolForEmployeeFromWorker(
  employee: Pick<Employee, 'department' | 'departments'>,
): Promise<ImplantCase[]> {
  const fcfsStages = fcfsStagesForEmployee(employee);
  if (fcfsStages.length === 0) return [];
  const pool = await getFcfsPoolListViaWorker(fcfsStages);
  const ids: string[] = [];
  for (const row of pool) {
    const stageDept = STAGE_DEPARTMENT_MAP[normalizeWorkflowStageName(row.current_stage)];
    if (stageDept && row.current_department !== stageDept) continue;
    ids.push(row.id);
  }
  const details = await getCaseDetailsByIds(ids);
  return caseDetailsToImplantCases(details).filter(
    (c) => !c.assignedEmployee && ['Active', 'Draft'].includes(c.status),
  );
}

export async function fetchCasesForEmployeeIncludingPoolFromWorker(
  employeeId: string,
  employee: Pick<Employee, 'department' | 'departments'>,
): Promise<ImplantCase[]> {
  const [assigned, pool] = await Promise.all([
    fetchCasesForEmployeeFromWorker(employeeId),
    fetchFcfsPoolForEmployeeFromWorker(employee),
  ]);
  const byId = new Map<string, ImplantCase>();
  for (const c of [...assigned, ...pool]) byId.set(c.id, c);
  return [...byId.values()];
}
