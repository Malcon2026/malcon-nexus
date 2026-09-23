import type { Employee, ImplantCase } from '../types';

export type CaseDutyKind = 'return' | 'pickupReturn' | 'cleaning' | 'restock';

export interface CaseDutySlot {
  assignedEmployee: Employee | null;
  assignedAt: string | null;
}

export type PostSurgeryDuties = Record<CaseDutyKind, CaseDutySlot>;

export const CASE_DUTY_KINDS: CaseDutyKind[] = ['return', 'pickupReturn', 'cleaning', 'restock'];

export const CASE_DUTY_LABELS: Record<CaseDutyKind, string> = {
  return: 'Return',
  pickupReturn: 'Pick up return',
  cleaning: 'Cleaning',
  restock: 'Restock',
};

export const CASE_DUTY_TAB_IDS = [
  'case-duties-combined',
  'case-duties-return',
  'case-duties-pickup',
  'case-duties-cleaning',
  'case-duties-restock',
] as const;

export type CaseDutyTabId = (typeof CASE_DUTY_TAB_IDS)[number];

export function isCaseDutyTab(tab: string): tab is CaseDutyTabId {
  return (CASE_DUTY_TAB_IDS as readonly string[]).includes(tab);
}

export function dutyKindForTab(tab: CaseDutyTabId): CaseDutyKind | 'all' {
  switch (tab) {
    case 'case-duties-return':
      return 'return';
    case 'case-duties-pickup':
      return 'pickupReturn';
    case 'case-duties-cleaning':
      return 'cleaning';
    case 'case-duties-restock':
      return 'restock';
    default:
      return 'all';
  }
}

export function emptyPostSurgeryDuties(): PostSurgeryDuties {
  const slot = (): CaseDutySlot => ({ assignedEmployee: null, assignedAt: null });
  return {
    return: slot(),
    pickupReturn: slot(),
    cleaning: slot(),
    restock: slot(),
  };
}

export function normalizePostSurgeryDuties(raw: unknown): PostSurgeryDuties {
  const base = emptyPostSurgeryDuties();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  for (const kind of CASE_DUTY_KINDS) {
    const entry = o[kind];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    base[kind] = {
      assignedEmployee: (e.assignedEmployee as Employee | null) ?? null,
      assignedAt: (e.assignedAt as string | null) ?? null,
    };
  }
  return base;
}

export function getDutySlot(c: ImplantCase, kind: CaseDutyKind): CaseDutySlot {
  return c.postSurgeryDuties?.[kind] ?? { assignedEmployee: null, assignedAt: null };
}

export function isOpenCaseForDutyBoard(c: ImplantCase): boolean {
  return c.status !== 'Completed' && c.status !== 'Cancelled';
}

export function casesForDutyBoard(cases: ImplantCase[]): ImplantCase[] {
  return cases.filter(isOpenCaseForDutyBoard);
}

export function buildPostSurgeryDutiesFromEmployeeIds(
  ids: Partial<Record<CaseDutyKind, string>>,
  employees: Employee[],
): PostSurgeryDuties {
  const duties = emptyPostSurgeryDuties();
  const now = new Date().toISOString();
  for (const kind of CASE_DUTY_KINDS) {
    const id = ids[kind]?.trim();
    if (!id) continue;
    const emp = employees.find((e) => e.id === id);
    if (!emp) continue;
    duties[kind] = { assignedEmployee: emp, assignedAt: now };
  }
  return duties;
}
