import type { ReturnOutcome } from '../types';

export type { ReturnOutcome };

/** Return duty picker — implants used at hospital; no pickup trip. */
export const RETURN_USED_NO_RETURN_VALUE = '__return_used_no_return__';
/** Return duty picker — set left parked at hospital; case completes at return. */
export const RETURN_PARKED_VALUE = '__return_parked__';

export const RETURN_OUTCOMES: { id: ReturnOutcome; title: string; hint: string }[] = [
  {
    id: 'used_no_return',
    title: 'Used / no return',
    hint: 'Implants used at hospital — skip pickup and assign cleaning',
  },
  {
    id: 'parked',
    title: 'Parked',
    hint: 'Set parked at hospital — complete case (no clean/restock)',
  },
];

export function isReturnDutySpecialValue(id: string | undefined | null): boolean {
  if (!id) return false;
  return id === RETURN_USED_NO_RETURN_VALUE || id === RETURN_PARKED_VALUE;
}

export function returnDutyIdToOutcome(id: string | undefined | null): ReturnOutcome | null {
  if (id === RETURN_USED_NO_RETURN_VALUE) return 'used_no_return';
  if (id === RETURN_PARKED_VALUE) return 'parked';
  return null;
}

export function returnOutcomeToDutyId(outcome: ReturnOutcome): string {
  return outcome === 'used_no_return' ? RETURN_USED_NO_RETURN_VALUE : RETURN_PARKED_VALUE;
}

export function returnOutcomeLabel(outcome: ReturnOutcome | null | undefined): string {
  if (outcome === 'used_no_return') return 'Used / no return';
  if (outcome === 'parked') return 'Parked';
  return '';
}

export function returnOutcomeBadgeClass(outcome: ReturnOutcome | null | undefined): string {
  if (outcome === 'used_no_return') return 'bg-violet-50 text-violet-800 border-violet-200';
  if (outcome === 'parked') return 'bg-slate-50 text-slate-800 border-slate-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}
