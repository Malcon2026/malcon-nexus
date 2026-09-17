import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { FOOD_MEALS, getFoodSelectionForDay, isFoodSelectionSubmitted, shiftMealDateKey } from '../lib/food';
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

const emptyDraft = (): Record<FoodMeal, boolean> => ({
  breakfast: false,
  lunch: false,
  dinner: false,
});

export const EmployeeFoodSection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const foodSelections = useStore((s) => s.foodSelections);
  const submitEmployeeFoodMeals = useStore((s) => s.submitEmployeeFoodMeals);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection = useMemo(
    () => getFoodSelectionForDay(foodSelections, currentUser.id, mealDate),
    [foodSelections, currentUser.id, mealDate],
  );

  const locked = isFoodSelectionSubmitted(selection);

  useEffect(() => {
    setError(null);
    if (locked && selection) {
      setDraft({
        breakfast: selection.breakfast,
        lunch: selection.lunch,
        dinner: selection.dinner,
      });
    } else {
      setDraft(emptyDraft());
    }
  }, [mealDate, locked, selection]);

  const toggle = (meal: FoodMeal) => {
    if (locked || submitting) return;
    setError(null);
    setDraft((d) => ({ ...d, [meal]: !d[meal] }));
  };

  const handleSubmit = async () => {
    if (locked || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitEmployeeFoodMeals(mealDate, draft);
      if (result.error) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  };

  const anySelected = draft.breakfast || draft.lunch || draft.dinner;

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

          {locked && (
            <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Submitted for this day. You cannot change your selection.</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-2">
            {FOOD_MEALS.map(({ id, label }) => {
              const active = draft[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked || submitting}
                  onClick={() => toggle(id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    locked
                      ? active
                        ? 'bg-rose-100 text-rose-900 border-rose-200 cursor-default'
                        : 'bg-gray-50 text-gray-400 border-gray-100 cursor-default'
                      : active
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-rose-200 hover:bg-rose-50/50'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-xs font-medium ${
                      locked ? (active ? 'text-rose-700' : 'text-gray-300') : active ? 'text-rose-100' : 'text-gray-400'
                    }`}
                  >
                    {active ? 'Selected' : locked ? '—' : 'Tap to select'}
                  </span>
                </button>
              );
            })}
          </div>

          {!locked && (
            <Button
              className="w-full"
              disabled={!anySelected || submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          )}

          <p className="text-xs text-gray-500">
            {locked
              ? `Your meals for ${formatMealDateLabel(mealDate).toLowerCase()} are locked.`
              : `Select meals for ${formatMealDateLabel(mealDate).toLowerCase()}, then tap Submit once. You cannot edit after submitting.`}
          </p>
        </CardBody>
      </Card>
    </div>
  );
};
