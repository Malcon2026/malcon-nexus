import type { Department } from '../types';
import { parseCsvObjects } from './csv';

const VALID_DEPARTMENTS = new Set<Department>([
  'Stores',
  'Delivery',
  'Scrub Person',
  'Cleaning Department',
  'Stores Audit',
  'Accounts',
  'Bill Submission',
  'Admin',
]);

const DEPARTMENT_ALIASES: Record<string, Department> = {
  scrub: 'Scrub Person',
  'scrub person': 'Scrub Person',
  cleaning: 'Cleaning Department',
  'cleaning department': 'Cleaning Department',
  audit: 'Stores Audit',
  'stores audit': 'Stores Audit',
  accounts: 'Accounts',
  collection: 'Bill Submission',
  'collection executive': 'Bill Submission',
  'bill submission': 'Bill Submission',
  admin: 'Admin',
  stores: 'Stores',
  delivery: 'Delivery',
};

export interface EmployeeCsvRow {
  name: string;
  email: string;
  password: string;
  department: Department;
  role: 'admin' | 'employee';
  phone: string;
  _line: number;
}

function normalizeDepartment(value: string, line: number): Department {
  const trimmed = value.trim();
  if (VALID_DEPARTMENTS.has(trimmed as Department)) {
    return trimmed as Department;
  }
  const alias = DEPARTMENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  throw new Error(
    `Row ${line}: invalid department "${value}". Use: ${[...VALID_DEPARTMENTS].join(', ')}`,
  );
}

function normalizeRole(value: string, line: number): 'admin' | 'employee' {
  const role = value.trim().toLowerCase();
  if (role === 'admin' || role === 'employee') return role;
  throw new Error(`Row ${line}: role must be "admin" or "employee".`);
}

export function parseEmployeeCsv(text: string): EmployeeCsvRow[] {
  const raw = parseCsvObjects<Record<string, string>>(text, {
    requiredColumns: ['name', 'email', 'password', 'department', 'role'],
  });

  return raw.map((row) => {
    const line = Number(row._line) || 0;
    const name = row.name?.trim() ?? '';
    const email = row.email?.trim().toLowerCase() ?? '';
    const password = row.password?.trim() ?? '';

    if (!name || !email || !password) {
      throw new Error(`Row ${line}: name, email, and password are required.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Row ${line}: invalid email "${email}".`);
    }

    return {
      name,
      email,
      password,
      department: normalizeDepartment(row.department ?? '', line),
      role: normalizeRole(row.role ?? 'employee', line),
      phone: row.phone?.trim() ?? '',
      _line: line,
    };
  });
}

export const EMPLOYEE_CSV_TEMPLATE = [
  'name,email,password,department,role,phone',
  'Bindhu,bindhu@malconnexus.com,Test@0011,Stores,employee,8019971125',
  'Ramakanth,ramakanth@malconnexus.com,Test@0011,Stores Audit,employee,8019971125',
].join('\n');
