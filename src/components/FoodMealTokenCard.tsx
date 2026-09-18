import React from 'react';
import { Ticket } from 'lucide-react';
import type { FoodMealToken } from '../lib/foodToken';
import { mealLabelsForToken } from '../lib/foodToken';
import { formatDateTime } from '../utils/helpers';

type FoodMealTokenCardProps = {
  token: FoodMealToken;
  compact?: boolean;
};

export const FoodMealTokenCard: React.FC<FoodMealTokenCardProps> = ({ token, compact = false }) => {
  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-rose-300 bg-gradient-to-br from-rose-50 to-white ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Meal token</p>
          <p className="text-2xl font-black text-gray-900 tracking-tight mt-0.5 font-mono">{token.code}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
          <Ticket className="h-5 w-5 text-rose-600" />
        </div>
      </div>
      <dl className={`mt-3 space-y-1.5 text-sm ${compact ? '' : 'text-base'}`}>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Name</dt>
          <dd className="font-semibold text-gray-900 text-right">{token.employeeName}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Date</dt>
          <dd className="font-semibold text-gray-900">{token.mealDate}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Meals</dt>
          <dd className="font-semibold text-gray-900 text-right">{mealLabelsForToken(token.meals)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Submitted</dt>
          <dd className="font-medium text-gray-800 text-right text-xs sm:text-sm">
            {formatDateTime(token.submittedAt)}
          </dd>
        </div>
      </dl>
      <p className="text-[11px] text-gray-500 mt-3 leading-snug">
        Show this token at the canteen. Valid for the meals selected above on this date only.
      </p>
    </div>
  );
};
