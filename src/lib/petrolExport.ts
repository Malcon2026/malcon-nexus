import type { Employee, PetrolRequest } from '../types';
import { petrolStatusLabel } from './petrol';
import { petrolFillDate } from './petrolStats';
import { downloadCsv } from '../utils/csv';

const HEADERS = [
  'Date',
  'Employee',
  'Employee ID',
  'Vehicle',
  'Amount',
  'Book no',
  'Token no',
  'Previous reading',
  'Current reading',
  'Km driven',
  'Status',
  'Bill received',
  'Notes',
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'staff';
}

export function petrolEntriesForExport(
  requests: PetrolRequest[],
  employeeId?: string,
  month?: string,
): PetrolRequest[] {
  return [...requests]
    .filter((r) => r.status !== 'cancelled' && r.status !== 'rejected')
    .filter((r) => (employeeId ? r.employeeId === employeeId : true))
    .filter((r) => (month ? petrolFillDate(r).startsWith(month) : true))
    .sort((a, b) => petrolFillDate(a).localeCompare(petrolFillDate(b)));
}

export function exportPetrolCsv(
  requests: PetrolRequest[],
  employees: Employee[],
  options: { employeeId?: string; month?: string; label?: string },
): { count: number; filename: string } {
  const rows = petrolEntriesForExport(requests, options.employeeId, options.month);
  if (rows.length === 0) {
    throw new Error('No petrol entries to export for this selection.');
  }

  const codeById = new Map(employees.map((e) => [e.id, e.employeeCode || '']));
  const filename = [
    'petrol',
    options.label ? slug(options.label) : options.employeeId ? 'employee' : 'all-staff',
    options.month || 'all',
  ].join('-');

  downloadCsv(
    `${filename}.csv`,
    HEADERS,
    rows.map((r) => [
      petrolFillDate(r),
      r.employeeName,
      codeById.get(r.employeeId) || '',
      r.vehicleNo,
      r.amount,
      r.bookNo,
      r.tokenNo,
      r.kmsStart ?? '',
      r.kmsEnd ?? '',
      r.kms ?? '',
      petrolStatusLabel[r.status],
      r.status === 'receipt_submitted' ? 'Yes' : 'No',
      r.notes,
    ]),
  );

  return { count: rows.length, filename: `${filename}.csv` };
}
