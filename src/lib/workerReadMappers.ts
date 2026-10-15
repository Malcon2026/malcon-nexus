import type {
  ActivityEvent,
  Approval,
  AttendanceApprovalRequest,
  AttendanceRecord,
  CaseTaskRequest,
  DailyExpense,
  Department,
  DepartmentInfo,
  Doctor,
  Employee,
  EmployeeFoodSelection,
  FieldTeamAttendanceApproval,
  Hospital,
  LeaveRequest,
  LocationTrip,
  Notification,
  PetrolRequest,
  SurgicalKit,
  WorkflowStage,
} from '../types';
import { normalizeDateKey } from './attendance';
import { doctorCodeFromRow } from './doctorCode';
import type { WorkerPgRow } from './workerApi';
import type {
  WorkerDepartmentRow,
  WorkerDoctorRow,
  WorkerHospitalRow,
  WorkerKitRow,
  WorkerNotificationRow,
} from './workerApi';
import { normalizeDepartment } from '../constants/departments';
import type { WorkerEmployeeRow } from './workerApi';

export function workerHospitalToApp(row: WorkerHospitalRow): Hospital {
  return {
    id: row.id,
    name: row.name,
    branch: row.branch ?? '',
    address: row.address,
    city: row.city,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    status: row.status as Hospital['status'],
  };
}

export function workerDoctorToApp(row: WorkerDoctorRow): Doctor {
  const storedCode = doctorCodeFromRow({
    doctor_code: row.doctor_code,
    phone: row.phone,
  });
  const phone = (row.phone ?? '').trim();
  const displayPhone = storedCode && phone.toUpperCase() === storedCode ? '' : phone;
  return {
    id: row.id,
    doctorCode: storedCode || row.master_list_code || undefined,
    name: row.name,
    specialization: row.specialization,
    hospitalId: row.hospital_id ?? '',
    phone: displayPhone,
  };
}

export function workerDepartmentToApp(row: WorkerDepartmentRow): DepartmentInfo {
  return {
    id: row.id,
    name: row.name as DepartmentInfo['name'],
    description: row.description,
    color: row.color,
  };
}

export function workerKitToApp(row: WorkerKitRow): SurgicalKit {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    serialNumber: row.serial_number,
    status: row.status as SurgicalKit['status'],
    lastUsedDate: row.last_used_date ?? undefined,
  };
}

export function workerNotificationToApp(row: WorkerNotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type as Notification['type'],
    timestamp: row.created_at,
    read: row.is_read,
    caseId: row.case_id ?? undefined,
  };
}

export function workerEmployeeToApp(row: WorkerEmployeeRow): Employee {
  const departments = (row.departments ?? [])
    .map((d) => normalizeDepartment(String(d)))
    .filter((d): d is Department => Boolean(d));
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: normalizeDepartment(row.department) ?? (row.department as Employee['department']),
    departments: departments.length ? departments : undefined,
    role: row.role as Employee['role'],
    status: row.status as Employee['status'],
    avatar: row.avatar,
    phone: row.phone,
    employeeCode: row.employee_code ?? '',
    telegramChatId: row.telegram_chat_id ?? null,
    casesCompleted: row.cases_completed,
    casesActive: row.cases_active,
    joinDate: row.join_date,
  };
}

export function workerAttendanceToApp(row: WorkerPgRow): AttendanceRecord {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    punchType: row.punch_type as AttendanceRecord['punchType'],
    punchedAt: row.punched_at as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    accuracyM: row.accuracy_m as number,
    distanceM: row.distance_m as number,
    withinOffice: row.within_office as boolean,
    officeAddress: row.office_address as string,
    selfieUrl: (row.selfie_url as string | null) ?? null,
  };
}

export function workerAttendanceApprovalToApp(row: WorkerPgRow): AttendanceApprovalRequest {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    punchType: row.punch_type as AttendanceApprovalRequest['punchType'],
    requestedAt: row.requested_at as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    accuracyM: row.accuracy_m as number,
    distanceM: row.distance_m as number,
    reason: row.reason as string,
    status: row.status as AttendanceApprovalRequest['status'],
    reviewedBy: row.reviewed_by as string | null,
    reviewedById: row.reviewed_by_id as string | null,
    reviewedAt: row.reviewed_at as string | null,
    adminNotes: (row.admin_notes as string | null) ?? '',
    attendanceRecordId: row.attendance_record_id as string | null,
    selfieUrl: (row.selfie_url as string | null) ?? null,
  };
}

export function workerFieldTeamAttendanceToApp(row: WorkerPgRow): FieldTeamAttendanceApproval {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    department: row.department as string,
    dateKey: normalizeDateKey(row.date_key as string),
    status: row.status as FieldTeamAttendanceApproval['status'],
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedById: (row.reviewed_by_id as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    adminNotes: (row.admin_notes as string | null) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function workerLeaveToApp(row: WorkerPgRow): LeaveRequest {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    leaveType: row.leave_type as LeaveRequest['leaveType'],
    fromDate: normalizeDateKey(row.from_date as string),
    toDate: normalizeDateKey(row.to_date as string),
    reason: row.reason as string,
    status: row.status as LeaveRequest['status'],
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedById: (row.reviewed_by_id as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    adminNotes: (row.admin_notes as string | null) ?? '',
    createdAt: row.created_at as string,
    compOffWorkDate: row.comp_off_work_date
      ? normalizeDateKey(row.comp_off_work_date as string)
      : null,
  };
}

export function workerPetrolToApp(row: WorkerPgRow): PetrolRequest {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: (row.employee_name as string) ?? '',
    vehicleNo: (row.vehicle_no as string) ?? '',
    amount: Number(row.amount ?? 0),
    requestedAt: row.requested_at as string,
    status: row.status as PetrolRequest['status'],
    bookNo: (row.book_no as string) ?? '',
    tokenNo: (row.token_no as string) ?? '',
    issuedBy: (row.issued_by as string | null) ?? null,
    issuedById: (row.issued_by_id as string | null) ?? null,
    issuedAt: (row.issued_at as string | null) ?? null,
    kms: row.kms == null ? null : Number(row.kms),
    kmsStart: row.kms_start == null ? null : Number(row.kms_start),
    kmsEnd: row.kms_end == null ? null : Number(row.kms_end),
    receiptUrl: (row.receipt_url as string) ?? '',
    kmsPhotoUrl: (row.kms_photo_url as string) ?? '',
    receiptSubmittedAt: (row.receipt_submitted_at as string | null) ?? null,
    notes: (row.notes as string) ?? '',
    adminNotes: (row.admin_notes as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function workerLocationTripToApp(row: WorkerPgRow): LocationTrip {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: (row.employee_name as string) ?? '',
    tripNo: Number(row.trip_no ?? 0),
    notes: (row.notes as string) ?? '',
    status: row.status === 'completed' ? 'completed' : 'started',
    startAt: row.start_at as string,
    startLat: Number(row.start_lat ?? 0),
    startLng: Number(row.start_lng ?? 0),
    startAccuracyM: Number(row.start_accuracy_m ?? 0),
    startPlusCode: (row.start_plus_code as string) ?? '',
    endAt: (row.end_at as string | null) ?? null,
    endLat: row.end_lat == null ? null : Number(row.end_lat),
    endLng: row.end_lng == null ? null : Number(row.end_lng),
    endAccuracyM: row.end_accuracy_m == null ? null : Number(row.end_accuracy_m),
    endPlusCode: (row.end_plus_code as string) ?? '',
    distanceKm: Number(row.distance_km ?? 0),
    bikeKm: row.bike_km == null ? null : Number(row.bike_km),
    bikeMinutes: row.bike_minutes == null ? null : Number(row.bike_minutes),
    bikeSource: (row.bike_source as string) ?? '',
    bikeMode: (row.bike_mode as string) ?? '',
    fromName: (row.from_name as string) ?? '',
    fromAddress: (row.from_address as string) ?? '',
    fromEloc: (row.from_eloc as string) ?? '',
    fromLat: row.from_lat == null ? null : Number(row.from_lat),
    fromLng: row.from_lng == null ? null : Number(row.from_lng),
    hospitalName: (row.hospital_name as string) ?? '',
    hospitalAddress: (row.hospital_address as string) ?? '',
    hospitalEloc: (row.hospital_eloc as string) ?? '',
    hospitalLat: row.hospital_lat == null ? null : Number(row.hospital_lat),
    hospitalLng: row.hospital_lng == null ? null : Number(row.hospital_lng),
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  };
}

export function workerFoodSelectionToApp(row: WorkerPgRow): EmployeeFoodSelection {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    mealDate: normalizeDateKey(row.meal_date as string),
    breakfast: Boolean(row.breakfast),
    lunch: Boolean(row.lunch),
    dinner: Boolean(row.dinner),
    submittedAt: (row.submitted_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function workerApprovalToApp(row: WorkerPgRow): Approval {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    caseNumber: row.case_number as string,
    stage: row.stage as WorkflowStage,
    submittedBy: row.submitted_by as string,
    submittedAt: row.submitted_at as string,
    approvedAt: (row.approved_at as string | null) ?? undefined,
    status: row.status as Approval['status'],
    notes: (row.notes as string | null) ?? undefined,
    adminNotes: (row.admin_notes as string | null) ?? undefined,
  };
}

export function workerCaseTaskRequestToApp(row: WorkerPgRow): CaseTaskRequest {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    caseNumber: row.case_number as string,
    stage: row.stage as CaseTaskRequest['stage'],
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    employeeDepartment: row.employee_department as CaseTaskRequest['employeeDepartment'],
    status: row.status as CaseTaskRequest['status'],
    requestedAt: row.requested_at as string,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedById: (row.reviewed_by_id as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    adminNotes: (row.admin_notes as string | null) ?? undefined,
  };
}

export function workerActivityToApp(row: WorkerPgRow): ActivityEvent {
  return {
    id: row.id as string,
    action: row.action as string,
    entityType: row.entity_type as ActivityEvent['entityType'],
    entityId: row.entity_id as string,
    entityLabel: row.entity_label as string,
    performedBy: row.performed_by as string,
    performedByRole: row.performed_by_role as ActivityEvent['performedByRole'],
    timestamp: row.created_at as string,
    details: row.details as string,
  };
}

export function workerDailyExpenseToApp(row: WorkerPgRow): DailyExpense {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    expenseDate: row.expense_date as string,
    kmsDriven: Number(row.kms_driven ?? 0),
    petrolAmount: Number(row.petrol_amount ?? 0),
    foodAmount: Number(row.food_amount ?? 0),
    otherAmount: Number(row.other_amount ?? 0),
    otherDescription: (row.other_description as string) ?? '',
    notes: (row.notes as string) ?? '',
    enteredBy: (row.entered_by as string) ?? '',
    enteredById: (row.entered_by_id as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Map Worker case detail JSON to the row shape expected by caseRowToImplantCase. */
export function workerCaseDetailToPgRow(detail: Record<string, unknown>): Record<string, unknown> {
  const invMinor = detail.invoice_amount_minor as number | null | undefined;
  const colMinor = detail.collected_amount_minor as number | null | undefined;
  return {
    id: detail.id,
    case_number: detail.case_number,
    hospital_snapshot: detail.hospital_snapshot,
    doctor_snapshot: detail.doctor_snapshot,
    surgery_date: detail.surgery_date,
    implant_required: detail.implant_required,
    implant_type: detail.implant_type,
    implant_company: detail.implant_company,
    priority: detail.priority,
    status: detail.status,
    current_stage: detail.current_stage,
    current_department: detail.current_department,
    assigned_employee_id: detail.assigned_employee_id,
    assigned_employee_snapshot: detail.assigned_employee_snapshot,
    created_by: detail.created_by,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    due_date: detail.due_date,
    remarks: detail.remarks,
    stages: detail.stages,
    activity_logs: detail.activity_logs,
    comments: detail.comments,
    invoice_amount: invMinor != null ? invMinor / 100 : undefined,
    collected_amount: colMinor != null ? colMinor / 100 : undefined,
    payment_status: detail.payment_status,
    cancel_reason: detail.cancel_reason,
    surgery_outcome: detail.surgery_outcome,
    surgery_outcome_detail: detail.surgery_outcome_detail,
    postpone_reason: detail.postpone_reason,
    postponed_from: detail.postponed_from,
    post_surgery_duties: detail.post_surgery_duties,
  };
}
