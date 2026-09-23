import React from 'react';
import type { ReturnOutcome } from '../types';
import { returnOutcomeBadgeClass, returnOutcomeLabel } from '../lib/returnPickup';

export const ReturnOutcomeBadge: React.FC<{ outcome: ReturnOutcome }> = ({ outcome }) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${returnOutcomeBadgeClass(outcome)}`}
  >
    {returnOutcomeLabel(outcome)}
  </span>
);
