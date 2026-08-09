import type { Department } from '../types';

/** Canonical department after merging Cleaning Department + Stores Audit. */
export const CLEANING_AUDIT_DEPARTMENT: Department = 'Cleaning & Audit';

export const DEPARTMENTS: Department[] = [
  'Stores',
  'Delivery',
  'Drivers',
  'Scrub Person',
  'Cleaning & Audit',
  'Accounts',
  'Bill Submission',
  'Office Staff',
  'Admin',
];

export const DEPARTMENTS_WITH_ALL: (Department | 'All')[] = ['All', ...DEPARTMENTS];

export const ASSIGNABLE_DEPARTMENTS: Department[] = DEPARTMENTS.filter((d) => d !== 'Admin');

export const departmentSelectClass =
  'px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';

/** Map legacy Cleaning / Stores Audit labels onto the merged department. */
export function normalizeDepartment(value: string | null | undefined): Department | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (
    trimmed === 'Cleaning Department' ||
    trimmed === 'Stores Audit' ||
    trimmed === 'Cleaning & Audit' ||
    trimmed === 'Cleaning' ||
    trimmed === 'Audit'
  ) {
    return CLEANING_AUDIT_DEPARTMENT;
  }
  if ((DEPARTMENTS as string[]).includes(trimmed)) {
    return trimmed as Department;
  }
  return null;
}
