import type { Employee, ImplantCase } from '../types';

export type CaseDutyKind = 'return' | 'pickupReturn' | 'cleaning' | 'restock';

export interface CaseDutySlot {
  assignedEmployee: Employee | null;
  assignedAt: string | null;
}

export type PostSurgeryDuties = Record<CaseDutyKind, CaseDutySlot>;

export const CASE_DUTY_KINDS: CaseDutyKind[] = ['return', 'pickupReturn', 'cleaning', 'restock'];

/** Display names for post-surgery team picks (not workflow stage assignees). */
export const CASE_DUTY_LABELS: Record<CaseDutyKind, string> = {
  return: 'Return',
  pickupReturn: 'Pick up',
  cleaning: 'Cleaning & audit',
  restock: 'Restock',
};

export const CASE_DUTIES_NAV_LABEL = 'Return & cleaning';

export const CASE_DUTIES_PAGE_TITLE = 'Return & cleaning team';

export const CASE_DUTIES_PAGE_DESCRIPTION =
  'Choose who handles return, cleaning, and restock. This is separate from the person assigned on the case workflow.';

export const CASE_DUTIES_CREATE_SECTION_TITLE = 'Return & cleaning team (optional)';

export const CASE_DUTIES_CREATE_SECTION_HINT =
  'Names for kit return and cleaning only — not the same as workflow stage assignees above.';

export function dutyPickerPlaceholder(kind: CaseDutyKind): string {
  return `Select — ${CASE_DUTY_LABELS[kind]}`;
}

export function dutyModalTitle(kind: CaseDutyKind): string {
  return `Who does ${CASE_DUTY_LABELS[kind]}?`;
}

/** Single sidebar route for all post-surgery duty assignment. */
export const CASE_DUTIES_TAB_ID = 'case-duties-combined' as const;

export type CaseDutyTabId = typeof CASE_DUTIES_TAB_ID;

const LEGACY_DUTY_TAB_IDS = [
  'case-duties-return',
  'case-duties-pickup',
  'case-duties-cleaning',
  'case-duties-restock',
] as const;

export const CASE_DUTY_TAB_IDS = [CASE_DUTIES_TAB_ID] as const;

export function isCaseDutyTab(tab: string): tab is CaseDutyTabId {
  return tab === CASE_DUTIES_TAB_ID || (LEGACY_DUTY_TAB_IDS as readonly string[]).includes(tab);
}

/** Saved tab ids from older builds → single combined duties route. */
export function remapLegacyDutyTab(tab: string): string {
  if (tab !== CASE_DUTIES_TAB_ID && isCaseDutyTab(tab)) return CASE_DUTIES_TAB_ID;
  return tab;
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
