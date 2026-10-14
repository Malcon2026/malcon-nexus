/**
 * Phase 10.2 — medium-risk Worker writes (no Supabase fallback).
 */
import { workerFetchJson } from './workerApi';
import { getEmployeeDepartments } from '../constants/departments';
import type {
  AttendanceApprovalRequest,
  AttendanceRecord,
  CaseTaskRequest,
  Doctor,
  Employee,
  EmployeeFoodSelection,
  FieldTeamAttendanceApproval,
  Hospital,
  LeaveRequest,
  LocationTrip,
  PetrolRequest,
} from '../types';

async function write(path: string, init: RequestInit): Promise<void> {
  await workerFetchJson<{ ok?: boolean }>(path, init);
}

export async function createEmployeeOnWorker(e: Employee): Promise<Employee> {
  await write('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: e.id,
      name: e.name,
      email: e.email,
      department: e.department,
      departments: getEmployeeDepartments(e),
      role: e.role,
      status: e.status,
      avatar: e.avatar,
      phone: e.phone,
      employeeCode: e.employeeCode,
      casesCompleted: e.casesCompleted,
      casesActive: e.casesActive,
      joinDate: e.joinDate,
    }),
  });
  return e;
}

export async function updateEmployeeOnWorker(id: string, updates: Partial<Employee>): Promise<void> {
  await write(`/api/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...updates,
      departments: updates.departments ?? (updates.department ? undefined : undefined),
    }),
  });
}

export async function deleteEmployeeOnWorker(id: string): Promise<void> {
  await write(`/api/employees/${id}`, { method: 'DELETE' });
}

export async function createHospitalOnWorker(h: Hospital): Promise<Hospital> {
  await write('/api/hospitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: h.id,
      name: h.name,
      branch: h.branch,
      address: h.address,
      city: h.city,
      contactPerson: h.contactPerson,
      phone: h.phone,
      email: h.email,
      status: h.status,
    }),
  });
  return h;
}

export async function updateHospitalOnWorker(id: string, u: Partial<Hospital>): Promise<void> {
  await write(`/api/hospitals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u),
  });
}

export async function deleteHospitalOnWorker(id: string): Promise<void> {
  await write(`/api/hospitals/${id}`, { method: 'DELETE' });
}

export async function createDoctorOnWorker(d: Doctor): Promise<Doctor> {
  await write('/api/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: d.id,
      name: d.name,
      specialization: d.specialization,
      hospitalId: d.hospitalId || null,
      phone: d.phone,
      doctorCode: d.doctorCode,
    }),
  });
  return d;
}

export async function updateDoctorOnWorker(id: string, u: Partial<Doctor>): Promise<void> {
  await write(`/api/doctors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u),
  });
}

export async function deleteDoctorOnWorker(id: string): Promise<void> {
  await write(`/api/doctors/${id}`, { method: 'DELETE' });
}

export async function insertAttendanceOnWorker(record: AttendanceRecord): Promise<void> {
  await write('/api/attendance-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
}

export async function patchAttendanceOnWorker(id: string, updates: Partial<AttendanceRecord>): Promise<void> {
  await write(`/api/attendance-records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteAttendanceIdsOnWorker(ids: string[]): Promise<void> {
  await write('/api/attendance-records/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export async function insertAttendanceApprovalOnWorker(request: AttendanceApprovalRequest): Promise<void> {
  await write('/api/attendance-approval-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function patchAttendanceApprovalOnWorker(
  id: string,
  updates: Partial<AttendanceApprovalRequest>,
): Promise<void> {
  await write(`/api/attendance-approval-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteAttendanceApprovalIdsOnWorker(ids: string[]): Promise<void> {
  await write('/api/attendance-approval-requests/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export async function upsertFieldTeamOnWorker(row: FieldTeamAttendanceApproval): Promise<void> {
  await write('/api/field-team-attendance', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
}

export async function patchFieldTeamOnWorker(id: string, updates: Partial<FieldTeamAttendanceApproval>): Promise<void> {
  await write(`/api/field-team-attendance/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function patchLeaveOnWorker(id: string, updates: Partial<LeaveRequest>): Promise<void> {
  await write(`/api/leave-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteLeaveIdsOnWorker(ids: string[]): Promise<void> {
  await write('/api/leave-requests/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export async function submitOwnLeaveOnWorker(request: LeaveRequest): Promise<void> {
  await write('/api/leave-requests/submit-own', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: request.id,
      leaveType: request.leaveType,
      fromDate: request.fromDate,
      toDate: request.toDate,
      reason: request.reason,
      compOffWorkDate: request.compOffWorkDate ?? null,
    }),
  });
}

type WorkerFoodRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  mealDate: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapWorkerFoodRow(row: WorkerFoodRow): EmployeeFoodSelection {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    mealDate: row.mealDate,
    breakfast: row.breakfast,
    lunch: row.lunch,
    dinner: row.dinner,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function submitOwnFoodOnWorker(
  selection: EmployeeFoodSelection,
): Promise<EmployeeFoodSelection> {
  const res = await workerFetchJson<{ data?: WorkerFoodRow }>('/api/food-selections/submit-own', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mealDate: selection.mealDate,
      breakfast: selection.breakfast,
      lunch: selection.lunch,
      dinner: selection.dinner,
    }),
  });
  if (!res.data) throw new Error('Worker food submit returned no data');
  return mapWorkerFoodRow(res.data);
}

export async function linkAuthUserOnWorker(employeeId: string): Promise<void> {
  await write('/api/employees/link-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId }),
  });
}

export async function upsertFoodOnWorker(selection: EmployeeFoodSelection): Promise<void> {
  await write(`/api/food-selections/${selection.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
  });
}

export async function adminSubmitFoodOnWorker(selection: EmployeeFoodSelection): Promise<EmployeeFoodSelection> {
  await write('/api/food-selections/admin-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
  });
  return selection;
}

export async function insertPetrolOnWorker(request: PetrolRequest): Promise<void> {
  await write('/api/petrol-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function patchPetrolOnWorker(id: string, updates: Partial<PetrolRequest>): Promise<void> {
  await write(`/api/petrol-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function removePetrolOnWorker(id: string): Promise<void> {
  await write(`/api/petrol-requests/${id}`, { method: 'DELETE' });
}

export async function removeAllPetrolOnWorker(): Promise<void> {
  await write('/api/petrol-requests', { method: 'DELETE' });
}

export async function insertLocationTripOnWorker(trip: LocationTrip): Promise<void> {
  await write('/api/location-trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  });
}

export async function patchLocationTripOnWorker(id: string, updates: Partial<LocationTrip>): Promise<void> {
  await write(`/api/location-trips/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function removeLocationTripOnWorker(id: string): Promise<void> {
  await write(`/api/location-trips/${id}`, { method: 'DELETE' });
}

export async function createCaseTaskOnWorker(req: CaseTaskRequest): Promise<CaseTaskRequest> {
  await write('/api/case-task-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return req;
}

export async function updateCaseTaskStatusOnWorker(
  id: string,
  status: CaseTaskRequest['status'],
  reviewed: { reviewedBy: string; reviewedById: string; adminNotes?: string },
): Promise<void> {
  await write(`/api/case-task-requests/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...reviewed }),
  });
}

export async function resolveCaseTasksOnWorker(
  caseId: string,
  approvedRequestId: string | null,
  assignedEmployeeId: string | null,
  reviewed: { reviewedBy: string; reviewedById: string; adminNotes?: string },
): Promise<void> {
  await write('/api/case-task-requests/resolve-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, approvedRequestId, assignedEmployeeId, reviewed }),
  });
}
