import type { RestockOutcome } from '../types';

export type { RestockOutcome };

export const RESTOCK_OUTCOMES: { id: RestockOutcome; title: string; hint: string }[] = [
  { id: 'restocked', title: 'Restocked', hint: 'Empty slots refilled from stock' },
  { id: 'order', title: 'Order', hint: 'Stock not available — order placed' },
];

export function restockOutcomeLabel(outcome: RestockOutcome | null | undefined): string {
  if (outcome === 'restocked') return 'Restocked';
  if (outcome === 'order') return 'Order placed';
  return '';
}

export function restockOutcomeBadgeClass(outcome: RestockOutcome | null | undefined): string {
  if (outcome === 'restocked') return 'bg-lime-50 text-lime-800 border-lime-200';
  if (outcome === 'order') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}
