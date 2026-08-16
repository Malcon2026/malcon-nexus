import React from 'react';
import { Package, ShoppingCart } from 'lucide-react';
import type { RestockOutcome } from '../types';
import { restockOutcomeBadgeClass, restockOutcomeLabel } from '../lib/restock';

export const RestockOutcomeBadge: React.FC<{ outcome: RestockOutcome }> = ({ outcome }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${restockOutcomeBadgeClass(outcome)}`}
  >
    {outcome === 'restocked' ? (
      <Package className="h-3 w-3 shrink-0" />
    ) : (
      <ShoppingCart className="h-3 w-3 shrink-0" />
    )}
    {restockOutcomeLabel(outcome)}
  </span>
);
