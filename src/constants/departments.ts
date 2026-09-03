import type { Department, Employee } from '../types';

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
  if (trimmed === 'Billing' || trimmed === 'Billing Department') {
    return 'Accounts';
  }
  if ((DEPARTMENTS as string[]).includes(trimmed)) {
    return trimmed as Department;
  }
  return null;
}

/** All departments an employee is eligible for (primary + extra roles). */
export function getEmployeeDepartments(emp: Pick<Employee, 'department' | 'departments'>): Department[] {
  const seen = new Set<Department>();
  const out: Department[] = [];
  const add = (raw: string | Department | null | undefined) => {
    const n = normalizeDepartment(String(raw ?? ''));
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  add(emp.department);
  for (const d of emp.departments ?? []) add(d);
  if (out.length === 0 && emp.department) return [emp.department];
  return out;
}

export function employeeCoversDepartment(
  emp: Pick<Employee, 'department' | 'departments'>,
  dept: string | null | undefined,
): boolean {
  const normalized = normalizeDepartment(dept ?? '');
  if (!normalized) return false;
  return getEmployeeDepartments(emp).includes(normalized);
}

export function formatEmployeeDepartments(
  emp: Pick<Employee, 'department' | 'departments'>,
  join = ' · ',
): string {
  return getEmployeeDepartments(emp).join(join);
}

/** Persist primary + full list from admin multi-select. */
export function buildEmployeeDepartmentFields(
  primary: Department,
  selected: Department[],
): Pick<Employee, 'department' | 'departments'> {
  const unique = Array.from(
    new Set(
      (selected.length ? selected : [primary]).map((d) => normalizeDepartment(d) ?? d),
    ),
  ) as Department[];
  const dept = unique.includes(primary) ? primary : unique[0] ?? primary;
  return { department: dept, departments: unique };
}
