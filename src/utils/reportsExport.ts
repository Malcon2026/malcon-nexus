import type {
  ActivityEvent,
  AttendanceApprovalRequest,
  Employee,
  Hospital,
  ImplantCase,
} from '../types';
import type { EmployeeAttendanceRow } from '../lib/attendance';
import { formatDuration, formatTimeIST } from '../lib/attendance';
import { downloadCsv } from './csv';
import { formatCurrency, formatDateTime } from './helpers';

export function exportAttendanceCsv(rows: EmployeeAttendanceRow[], dateKey: string): void {
  downloadCsv(
    `attendance-report-${dateKey}`,
    ['Employee', 'Department', 'Punch In', 'Punch Out', 'Hours', 'Status'],
    rows.map((row) => [
      row.employeeName,
      row.department,
      row.punchIn ? formatTimeIST(row.punchIn.punchedAt) : '',
      row.punchOut ? formatTimeIST(row.punchOut.punchedAt) : '',
      row.punchIn ? formatDuration(row.workedMs) : '',
      row.status,
    ]),
  );
}

export function exportEmployeesCsv(employees: Employee[]): void {
  downloadCsv(
    `employees-report-${new Date().toISOString().slice(0, 10)}`,
    ['Name', 'Email', 'Department', 'Role', 'Status', 'Phone', 'Cases Completed', 'Active Cases', 'Join Date'],
    employees.map((e) => [
      e.name,
      e.email,
      e.department,
      e.role,
      e.status,
      e.phone,
      e.casesCompleted,
      e.casesActive,
      e.joinDate,
    ]),
  );
}

export function exportActivityCsv(events: ActivityEvent[]): void {
  downloadCsv(
    `activity-report-${new Date().toISOString().slice(0, 10)}`,
    ['Timestamp', 'Action', 'Entity Type', 'Entity', 'Performed By', 'Role', 'Details'],
    events.map((e) => [
      formatDateTime(e.timestamp),
      e.action,
      e.entityType,
      e.entityLabel,
      e.performedBy,
      e.performedByRole,
      e.details,
    ]),
  );
}

export function exportAttendanceApprovalsCsv(requests: AttendanceApprovalRequest[]): void {
  downloadCsv(
    `attendance-approvals-${new Date().toISOString().slice(0, 10)}`,
    ['Employee', 'Requested At', 'Distance (m)', 'Reason', 'Status', 'Reviewed By', 'Reviewed At', 'Admin Notes'],
    requests.map((r) => [
      r.employeeName,
      formatDateTime(r.requestedAt),
      r.distanceM,
      r.reason,
      r.status,
      r.reviewedBy ?? '',
      r.reviewedAt ? formatDateTime(r.reviewedAt) : '',
      r.adminNotes,
    ]),
  );
}

export function exportHospitalsCsv(hospitals: Hospital[], cases: ImplantCase[]): void {
  const caseCount = (id: string) => cases.filter((c) => c.hospital.id === id).length;
  const activeCount = (id: string) =>
    cases.filter((c) => c.hospital.id === id && c.status !== 'Completed' && c.status !== 'Cancelled').length;

  downloadCsv(
    `hospitals-report-${new Date().toISOString().slice(0, 10)}`,
    ['Hospital', 'Branch', 'City', 'Contact', 'Phone', 'Email', 'Status', 'Total Cases', 'Active Cases'],
    hospitals.map((h) => [
      h.name,
      h.branch,
      h.city,
      h.contactPerson,
      h.phone,
      h.email,
      h.status,
      caseCount(h.id),
      activeCount(h.id),
    ]),
  );
}

export function exportBillingCsv(cases: ImplantCase[]): void {
  downloadCsv(
    `billing-report-${new Date().toISOString().slice(0, 10)}`,
    ['Case ID', 'Hospital', 'Stage', 'Invoice Amount', 'Collected', 'Payment Status'],
    cases
      .filter((c) => c.invoiceAmount)
      .map((c) => [
        c.caseNumber,
        c.hospital.name,
        c.currentStage,
        formatCurrency(c.invoiceAmount || 0),
        formatCurrency(c.collectedAmount || 0),
        c.paymentStatus || 'Pending',
      ]),
  );
}
