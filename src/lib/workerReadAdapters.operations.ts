import type {
  AttendanceApprovalRequest,
  AttendanceRecord,
  DailyExpense,
  EmployeeFoodSelection,
  FieldTeamAttendanceApproval,
  LeaveRequest,
  LocationTrip,
  PetrolRequest,
} from '../types';
import {
  getAllAttendanceApprovalsViaWorker,
  getAllAttendanceRecordsViaWorker,
  getAllDailyExpensesViaWorker,
  getAllFieldTeamAttendanceViaWorker,
  getAllFoodSelectionsViaWorker,
  getAllLeaveRequestsViaWorker,
  getAllLocationTripsViaWorker,
  getAllPetrolRequestsViaWorker,
  getRecentEmployeeAttendanceViaWorker,
  type WorkerPgRow,
} from './workerApi';
import {
  workerAttendanceApprovalToApp,
  workerAttendanceToApp,
  workerDailyExpenseToApp,
  workerFoodSelectionToApp,
  workerFieldTeamAttendanceToApp,
  workerLeaveToApp,
  workerLocationTripToApp,
  workerPetrolToApp,
} from './workerReadMappers';

function mapRows<T>(rows: WorkerPgRow[], fn: (row: WorkerPgRow) => T): T[] {
  return rows.map(fn);
}

export async function fetchAllAttendanceFromWorker(): Promise<AttendanceRecord[]> {
  const rows = await getAllAttendanceRecordsViaWorker({});
  return mapRows(rows, workerAttendanceToApp);
}

export async function fetchRecentAttendanceForEmployeeFromWorker(
  employeeId: string,
  sinceIso: string,
): Promise<AttendanceRecord[]> {
  const rows = await getRecentEmployeeAttendanceViaWorker(employeeId, sinceIso);
  return mapRows(rows, workerAttendanceToApp);
}

export async function fetchAllAttendanceApprovalsFromWorker(): Promise<AttendanceApprovalRequest[]> {
  const rows = await getAllAttendanceApprovalsViaWorker();
  return mapRows(rows, workerAttendanceApprovalToApp);
}

export async function fetchAttendanceApprovalsForEmployeeFromWorker(
  employeeId: string,
): Promise<AttendanceApprovalRequest[]> {
  const rows = await getAllAttendanceApprovalsViaWorker(employeeId);
  return mapRows(rows, workerAttendanceApprovalToApp);
}

export async function fetchAllFieldTeamAttendanceFromWorker(): Promise<FieldTeamAttendanceApproval[]> {
  const rows = await getAllFieldTeamAttendanceViaWorker();
  return mapRows(rows, workerFieldTeamAttendanceToApp);
}

export async function fetchFieldTeamAttendanceForDateFromWorker(
  dateKey: string,
): Promise<FieldTeamAttendanceApproval[]> {
  const rows = await getAllFieldTeamAttendanceViaWorker(dateKey);
  return mapRows(rows, workerFieldTeamAttendanceToApp);
}

export async function fetchAllLeaveFromWorker(): Promise<LeaveRequest[]> {
  const rows = await getAllLeaveRequestsViaWorker();
  return mapRows(rows, workerLeaveToApp);
}

export async function fetchLeaveForEmployeeFromWorker(employeeId: string): Promise<LeaveRequest[]> {
  const rows = await getAllLeaveRequestsViaWorker(employeeId);
  return mapRows(rows, workerLeaveToApp);
}

export async function fetchAllPetrolFromWorker(): Promise<PetrolRequest[]> {
  const rows = await getAllPetrolRequestsViaWorker();
  return mapRows(rows, workerPetrolToApp);
}

export async function fetchPetrolForEmployeeFromWorker(employeeId: string): Promise<PetrolRequest[]> {
  const rows = await getAllPetrolRequestsViaWorker(employeeId);
  return mapRows(rows, workerPetrolToApp);
}

export async function fetchAllLocationTripsFromWorker(): Promise<LocationTrip[]> {
  const rows = await getAllLocationTripsViaWorker();
  return mapRows(rows, workerLocationTripToApp);
}

export async function fetchLocationTripsForEmployeeFromWorker(employeeId: string): Promise<LocationTrip[]> {
  const rows = await getAllLocationTripsViaWorker(employeeId);
  return mapRows(rows, workerLocationTripToApp);
}

export async function fetchAllFoodFromWorker(): Promise<EmployeeFoodSelection[]> {
  const rows = await getAllFoodSelectionsViaWorker({});
  return mapRows(rows, workerFoodSelectionToApp);
}

export async function fetchFoodForEmployeeFromWorker(employeeId: string): Promise<EmployeeFoodSelection[]> {
  const rows = await getAllFoodSelectionsViaWorker({ employeeId });
  return mapRows(rows, workerFoodSelectionToApp);
}

export async function fetchFoodForDateRangeFromWorker(
  fromDate: string,
  toDate: string,
): Promise<EmployeeFoodSelection[]> {
  const rows = await getAllFoodSelectionsViaWorker({ fromDate, toDate });
  return mapRows(rows, workerFoodSelectionToApp);
}

export async function fetchAllDailyExpensesFromWorker(): Promise<DailyExpense[]> {
  const rows = await getAllDailyExpensesViaWorker();
  return mapRows(rows, workerDailyExpenseToApp);
}
