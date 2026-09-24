import type { RestockOutcome } from '../types';

export type { RestockOutcome };

export type RestockOutcomeTone = 'lime' | 'sky' | 'amber';

export const RESTOCK_OUTCOMES: {
  id: RestockOutcome;
  title: string;
  hint: string;
  tone: RestockOutcomeTone;
}[] = [
  { id: 'restocked', title: 'Restocked', hint: 'Empty slots refilled from stock', tone: 'lime' },
  {
    id: 'no_restock',
    title: 'No restock needed',
    hint: 'Kit is complete — nothing to refill or order',
    tone: 'sky',
  },
  {
    id: 'order',
    title: 'Restock ordered',
    hint: 'Stock not on hand — order placed (note supplier / follow-up in notes)',
    tone: 'amber',
  },
];

export function restockOutcomeLabel(outcome: RestockOutcome | null | undefined): string {
  const row = RESTOCK_OUTCOMES.find((o) => o.id === outcome);
  return row?.title ?? '';
}

export function restockOutcomeBadgeClass(outcome: RestockOutcome | null | undefined): string {
  if (outcome === 'restocked') return 'bg-lime-50 text-lime-800 border-lime-200';
  if (outcome === 'no_restock') return 'bg-sky-50 text-sky-800 border-sky-200';
  if (outcome === 'order') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}
