import React from 'react';
import { Package, ShoppingCart, CircleCheck } from 'lucide-react';
import type { RestockOutcome } from '../types';
import { restockOutcomeBadgeClass, restockOutcomeLabel } from '../lib/restock';

function RestockOutcomeIcon({ outcome }: { outcome: RestockOutcome }) {
  if (outcome === 'restocked') return <Package className="h-3 w-3 shrink-0" />;
  if (outcome === 'no_restock') return <CircleCheck className="h-3 w-3 shrink-0" />;
  return <ShoppingCart className="h-3 w-3 shrink-0" />;
}

export const RestockOutcomeBadge: React.FC<{ outcome: RestockOutcome }> = ({ outcome }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${restockOutcomeBadgeClass(outcome)}`}
  >
    <RestockOutcomeIcon outcome={outcome} />
    {restockOutcomeLabel(outcome)}
  </span>
);
