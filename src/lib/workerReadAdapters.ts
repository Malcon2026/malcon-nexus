import type { DepartmentInfo, Doctor, Employee, Hospital, ImplantCase, Notification, SurgicalKit } from '../types';
import {
  getAllCasesViaWorker,
  getAllDoctorsViaWorker,
  getAllHospitalsViaWorker,
  getAllNotificationsViaWorker,
  getAppSettingsViaWorker,
  getCase,
  getDepartmentsViaWorker,
  getEmployee,
  getEmployees,
  getSurgicalKitsViaWorker,
} from './workerApi';
import {
  workerCaseDetailToPgRow,
  workerDepartmentToApp,
  workerDoctorToApp,
  workerEmployeeToApp,
  workerHospitalToApp,
  workerKitToApp,
  workerNotificationToApp,
} from './workerReadMappers';

let caseRowToImplantCaseFn: ((row: Record<string, unknown>) => ImplantCase) | null = null;

async function toImplantCase(detail: Record<string, unknown>): Promise<ImplantCase> {
  if (!caseRowToImplantCaseFn) {
    const mod = await import('./database/repositories/supabaseRepositories');
    caseRowToImplantCaseFn = mod.caseRowToImplantCase;
  }
  return caseRowToImplantCaseFn(workerCaseDetailToPgRow(detail));
}

export async function fetchEmployeesFromWorker(): Promise<Employee[]> {
  const rows = await getEmployees();
  return rows.map(workerEmployeeToApp);
}

export async function fetchEmployeeByIdFromWorker(id: string): Promise<Employee | null> {
  const row = await getEmployee(id);
  return row ? workerEmployeeToApp(row) : null;
}

export async function fetchAllCasesFromWorker(): Promise<ImplantCase[]> {
  const details = await getAllCasesViaWorker();
  return Promise.all(details.map((d) => toImplantCase(d)));
}

export async function fetchHospitalsFromWorker(): Promise<Hospital[]> {
  const rows = await getAllHospitalsViaWorker();
  return rows.map(workerHospitalToApp);
}

export async function fetchDoctorsFromWorker(): Promise<Doctor[]> {
  const rows = await getAllDoctorsViaWorker();
  return rows.map(workerDoctorToApp);
}

export async function fetchDepartmentsFromWorker(): Promise<DepartmentInfo[]> {
  const rows = await getDepartmentsViaWorker();
  return rows.map(workerDepartmentToApp);
}

export async function fetchKitsFromWorker(): Promise<SurgicalKit[]> {
  const rows = await getSurgicalKitsViaWorker();
  return rows.map(workerKitToApp);
}

export async function fetchSettingsFromWorker(): Promise<Record<string, string>> {
  return getAppSettingsViaWorker();
}

export async function fetchNotificationsFromWorker(recipientId?: string): Promise<Notification[]> {
  const rows = await getAllNotificationsViaWorker(recipientId);
  return rows.map(workerNotificationToApp);
}

export async function fetchCaseByIdFromWorker(id: string): Promise<ImplantCase | null> {
  const detail = await getCase(id);
  if (!detail) return null;
  return toImplantCase(detail);
}

export {
  fetchAllAttendanceApprovalsFromWorker,
  fetchAllAttendanceFromWorker,
  fetchAllDailyExpensesFromWorker,
  fetchAllFieldTeamAttendanceFromWorker,
  fetchAllFoodFromWorker,
  fetchAllLeaveFromWorker,
  fetchAllLocationTripsFromWorker,
  fetchAllPetrolFromWorker,
  fetchAttendanceApprovalsForEmployeeFromWorker,
  fetchFieldTeamAttendanceForDateFromWorker,
  fetchFoodForDateRangeFromWorker,
  fetchFoodForEmployeeFromWorker,
  fetchLeaveForEmployeeFromWorker,
  fetchLocationTripsForEmployeeFromWorker,
  fetchPetrolForEmployeeFromWorker,
  fetchRecentAttendanceForEmployeeFromWorker,
} from './workerReadAdapters.operations';
export {
  fetchActivityFromWorker,
  fetchAllCaseTaskRequestsFromWorker,
  fetchApprovalsFromWorker,
  fetchCaseTaskRequestsForEmployeeFromWorker,
  fetchCasesForEmployeeFromWorker,
  fetchCasesForEmployeeIncludingPoolFromWorker,
  fetchFcfsPoolForEmployeeFromWorker,
  fetchPendingCaseTaskRequestsForCaseFromWorker,
} from './workerReadAdapters.remaining';
