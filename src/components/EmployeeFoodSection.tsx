import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, Lock, Eye } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { FOOD_MEALS, getFoodSelectionForDay, isFoodSelectionSubmitted, shiftMealDateKey } from '../lib/food';
import { getISTDateKey } from '../lib/attendance';
import type { FoodMeal } from '../types';
import { Te } from './BilingualText';
import { buildFoodMealToken } from '../lib/foodToken';
import { FoodMealTokenCard } from './FoodMealTokenCard';

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
  const loadFoodSelectionsWindow = useStore((s) => s.loadFoodSelectionsWindow);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const selection = useMemo(
    () => getFoodSelectionForDay(foodSelections, currentUser.id, mealDate),
    [foodSelections, currentUser.id, mealDate],
  );

  const locked = isFoodSelectionSubmitted(selection);

  const token = useMemo(() => {
    if (!locked || !selection) return null;
    return buildFoodMealToken(selection, currentUser.name);
  }, [locked, selection, currentUser.name]);

  useEffect(() => {
    void loadFoodSelectionsWindow(mealDate);
  }, [mealDate, loadFoodSelectionsWindow]);

  useEffect(() => {
    setError(null);
    setShowToken(false);
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
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowToken(true);
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

          {!locked && (
            <p className="text-sm text-gray-600">
              Tap a meal tile, then press <span className="font-semibold text-gray-900">Submit</span>.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {FOOD_MEALS.map(({ id, label, iconSrc }) => {
              const active = draft[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked || submitting}
                  onClick={() => toggle(id)}
                  className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-2 transition-all ${
                    locked
                      ? active
                        ? 'border-rose-200 bg-rose-50 opacity-100'
                        : 'border-gray-100 bg-gray-50 opacity-50'
                      : active
                        ? 'border-rose-500 bg-rose-50 shadow-md shadow-rose-200/50 scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-rose-200 hover:bg-rose-50/40'
                  }`}
                >
                  <img src={iconSrc} alt="" className="h-14 w-14 object-contain pointer-events-none" />
                  <span
                    className={`text-xs font-bold text-center leading-tight ${
                      active ? 'text-rose-700' : 'text-gray-600'
                    }`}
                  >
                    {label}
                  </span>
                  {active && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Selected</span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            className="w-full !bg-rose-600 hover:!bg-rose-500 focus:ring-rose-500 shadow-sm"
            size="lg"
            disabled={locked || !anySelected || submitting}
            onClick={() => void handleSubmit()}
          >
            {locked ? 'Submitted' : submitting ? 'Submitting…' : 'Submit'}
          </Button>

          {locked && token && (
            <div className="space-y-3 pt-1">
              {!showToken ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-rose-200 text-rose-800 hover:bg-rose-50"
                  size="lg"
                  icon={<Eye className="h-4 w-4" />}
                  onClick={() => setShowToken(true)}
                >
                  Show meal token
                </Button>
              ) : (
                <FoodMealTokenCard token={token} />
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
