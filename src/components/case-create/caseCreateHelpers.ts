import type { Doctor, Employee, Hospital, ImplantCase } from '../../types';
import { SURGERY_SELF_ASSIGNMENT_VALUE } from '../../lib/caseWorkflow';
import {
  RETURN_OUTCOMES,
  RETURN_PARKED_VALUE,
  RETURN_USED_NO_RETURN_VALUE,
} from '../../lib/returnPickup';
import { employeeCoversDepartment, getEmployeeDepartments } from '../../constants/departments';

/* ------------------------------------------------------------------ */
/* Hospitals — recent / frequent (derived from existing cases only)    */
/* ------------------------------------------------------------------ */

export function rankHospitals(
  cases: ImplantCase[],
  hospitals: Hospital[],
): { recent: Hospital[]; frequent: Hospital[] } {
  const active = new Map(hospitals.filter((h) => h.status === 'Active').map((h) => [h.id, h]));
  const newestFirst = [...cases].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const counts = new Map<string, number>();
  const recentOrder: string[] = [];

  for (const c of newestFirst) {
    const id = c.hospital?.id;
    if (!id || !active.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!recentOrder.includes(id)) recentOrder.push(id);
  }

  const recent = recentOrder.slice(0, 3).map((id) => active.get(id)!);
  const recentIds = new Set(recent.map((h) => h.id));
  const frequent = [...counts.entries()]
    .filter(([id]) => !recentIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => active.get(id)!);

  return { recent, frequent };
}

export function hospitalSubtitle(hospital: Hospital): string {
  return [hospital.address, hospital.city].filter(Boolean).join(', ');
}

/* ------------------------------------------------------------------ */
/* Doctors — existing names for a hospital (cases + doctors store)     */
/* ------------------------------------------------------------------ */

export interface DoctorOption {
  name: string;
  count: number;
}

/** Every doctor name known to the app (any hospital) — doctors are not tied to a hospital when creating a case. */
export function allDoctors(cases: ImplantCase[], doctors: Doctor[]): DoctorOption[] {
  const byKey = new Map<string, DoctorOption>();
  const newestFirst = [...cases].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  for (const c of newestFirst) {
    const name = (c.doctor?.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { name, count: 1 });
  }

  for (const d of doctors) {
    const name = (d.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { name, count: 0 });
  }

  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Most recently used distinct doctor names (quick-pick chips). */
export function recentDoctorNames(cases: ImplantCase[], limit = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const newestFirst = [...cases].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  for (const c of newestFirst) {
    const name = (c.doctor?.name ?? '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

/** Most-used procedure names from existing cases (quick-fill chips). */
export function commonProcedures(cases: ImplantCase[], limit = 4): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const c of cases) {
    const label = (c.implantRequired ?? '').trim();
    if (!label || label.length > 40) continue;
    const key = label.toLowerCase();
    const row = counts.get(key);
    if (row) row.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((r) => r.label);
}

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

export function matchesEmployee(emp: Employee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    emp.name.toLowerCase().includes(q) ||
    getEmployeeDepartments(emp).some((d) => d.toLowerCase().includes(q)) ||
    (emp.email ?? '').toLowerCase().includes(q) ||
    (emp.employeeCode ?? '').toLowerCase().includes(q)
  );
}

/** Same ordering rule as the old picker: people from the stage's department first. */
export function splitEmployeesByDepartment(
  employees: Employee[],
  suggestedDepartment?: string | null,
): { preferred: Employee[]; others: Employee[] } {
  const byName = (a: Employee, b: Employee) => a.name.localeCompare(b.name);
  if (!suggestedDepartment) return { preferred: [], others: [...employees].sort(byName) };
  return {
    preferred: employees.filter((e) => employeeCoversDepartment(e, suggestedDepartment)).sort(byName),
    others: employees.filter((e) => !employeeCoversDepartment(e, suggestedDepartment)).sort(byName),
  };
}

/** Same wording the rest of the app uses for SURGERY_SELF_ASSIGNMENT_VALUE. */
export const HOSPITAL_SELF_LABEL = 'Self — Hospital performs surgery';

export type AssigneeView =
  | { kind: 'none' }
  | { kind: 'hospital'; label: string }
  | { kind: 'special'; label: string }
  | { kind: 'person'; employee: Employee; isMe: boolean };

/** Turns a draft value (employee id or special sentinel) into something displayable. */
export function resolveAssignee(
  value: string | undefined,
  pool: Employee[],
  currentUser: Employee,
): AssigneeView {
  if (!value) return { kind: 'none' };
  if (value === SURGERY_SELF_ASSIGNMENT_VALUE) {
    return { kind: 'hospital', label: HOSPITAL_SELF_LABEL };
  }
  if (value === RETURN_USED_NO_RETURN_VALUE || value === RETURN_PARKED_VALUE) {
    const id = value === RETURN_USED_NO_RETURN_VALUE ? 'used_no_return' : 'parked';
    return {
      kind: 'special',
      label: RETURN_OUTCOMES.find((o) => o.id === id)?.title ?? 'Special',
    };
  }
  const employee = pool.find((e) => e.id === value) ?? (currentUser.id === value ? currentUser : undefined);
  if (!employee) return { kind: 'none' };
  return { kind: 'person', employee, isMe: employee.id === currentUser.id };
}
