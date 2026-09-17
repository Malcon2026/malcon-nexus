import React, { useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { useStore } from '../store/useStore';
import { FOOD_MEALS, getFoodSelectionForDay, shiftMealDateKey } from '../lib/food';
import { getISTDateKey } from '../lib/attendance';
import type { FoodMeal } from '../types';
import { Te } from './BilingualText';

function formatMealDateLabel(dateKey: string): string {
  const today = getISTDateKey();
  if (dateKey === today) return 'Today';
  const yesterday = shiftMealDateKey(today, -1);
  if (dateKey === yesterday) return 'Yesterday';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export const EmployeeFoodSection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const foodSelections = useStore((s) => s.foodSelections);
  const saveEmployeeFoodMeals = useStore((s) => s.saveEmployeeFoodMeals);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [busy, setBusy] = useState<FoodMeal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selection = useMemo(
    () => getFoodSelectionForDay(foodSelections, currentUser.id, mealDate),
    [foodSelections, currentUser.id, mealDate],
  );

  const meals = {
    breakfast: selection?.breakfast ?? false,
    lunch: selection?.lunch ?? false,
    dinner: selection?.dinner ?? false,
  };

  const toggle = async (meal: FoodMeal) => {
    setError(null);
    setBusy(meal);
    const next = { ...meals, [meal]: !meals[meal] };
    try {
      const result = await saveEmployeeFoodMeals(mealDate, next);
      if (result.error) setError(result.error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Food</p>
              <Te className="text-gray-500 mb-0">Breakfast · Lunch · Dinner</Te>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              aria-label="Previous day"
              onClick={() => setMealDate((d) => shiftMealDateKey(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-gray-900">{formatMealDateLabel(mealDate)}</p>
            <button
              type="button"
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              aria-label="Next day"
              onClick={() => setMealDate((d) => shiftMealDateKey(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-2">
            {FOOD_MEALS.map(({ id, label }) => {
              const active = meals[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void toggle(id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-gray-800 border-gray-200 hover:border-rose-200 hover:bg-rose-50/50'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-xs font-medium ${active ? 'text-rose-100' : 'text-gray-400'}`}>
                    {busy === id ? 'Saving…' : active ? 'Selected' : 'Tap to select'}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-gray-500">
            Select what you need for {formatMealDateLabel(mealDate).toLowerCase()}. You can change this anytime.
          </p>
        </CardBody>
      </Card>
    </div>
  );
};
