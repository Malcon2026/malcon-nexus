import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, Lock, Eye, ArrowRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import {
  FOOD_MEALS,
  FOOD_MEAL_ITEMS,
  getFoodSelectionForDay,
  isFoodSelectionSubmitted,
  itemLabelsForMeal,
  mealEnabledFromItems,
  shiftMealDateKey,
} from '../lib/food';
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

type SelectionMode = 'all' | 'individual';

const MEAL_ORDER: FoodMeal[] = ['breakfast', 'lunch', 'dinner'];

const emptyDraft = (): Record<FoodMeal, boolean> => ({
  breakfast: false,
  lunch: false,
  dinner: false,
});

const emptyItemDraft = (): Record<FoodMeal, string[]> => ({
  breakfast: [],
  lunch: [],
  dinner: [],
});

export const EmployeeFoodSection: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const foodSelections = useStore((s) => s.foodSelections);
  const submitEmployeeFoodMeals = useStore((s) => s.submitEmployeeFoodMeals);
  const loadFoodSelectionsWindow = useStore((s) => s.loadFoodSelectionsWindow);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [mode, setMode] = useState<SelectionMode>('individual');
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [itemDraft, setItemDraft] = useState(emptyItemDraft);
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
    setStepIndex(0);
    if (locked && selection) {
      setDraft({
        breakfast: selection.breakfast,
        lunch: selection.lunch,
        dinner: selection.dinner,
      });
      setItemDraft(emptyItemDraft());
    } else {
      setDraft(emptyDraft());
      setItemDraft(emptyItemDraft());
    }
  }, [mealDate, locked, selection]);

  const mealsFromItems = (items: Record<FoodMeal, string[]>) => ({
    breakfast: mealEnabledFromItems(items.breakfast),
    lunch: mealEnabledFromItems(items.lunch),
    dinner: mealEnabledFromItems(items.dinner),
  });

  const toggleMealAll = (meal: FoodMeal) => {
    if (locked || submitting) return;
    setError(null);
    setDraft((d) => {
      const next = { ...d, [meal]: !d[meal] };
      if (!next[meal]) {
        setItemDraft((items) => ({ ...items, [meal]: [] }));
      } else if (mode === 'all') {
        setItemDraft((items) => ({
          ...items,
          [meal]: FOOD_MEAL_ITEMS[meal].map((i) => i.id),
        }));
      }
      return next;
    });
  };

  const toggleItem = (meal: FoodMeal, itemId: string) => {
    if (locked || submitting) return;
    setError(null);
    setItemDraft((prev) => {
      const set = new Set(prev[meal]);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      const nextItems = { ...prev, [meal]: [...set] };
      setDraft(mealsFromItems(nextItems));
      return nextItems;
    });
  };

  const currentMeal = MEAL_ORDER[stepIndex];
  const onReviewStep = stepIndex >= MEAL_ORDER.length;

  const goNextStep = () => {
    if (onReviewStep) return;
    setStepIndex((i) => Math.min(i + 1, MEAL_ORDER.length));
  };

  const goPrevStep = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const skipMealStep = () => {
    if (!currentMeal || onReviewStep) return;
    setItemDraft((prev) => {
      const next = { ...prev, [currentMeal]: [] };
      setDraft(mealsFromItems(next));
      return next;
    });
    goNextStep();
  };

  const handleSubmit = async () => {
    if (locked || submitting) return;
    setError(null);
    const meals = mode === 'individual' ? draft : draft;
    if (!meals.breakfast && !meals.lunch && !meals.dinner) {
      setError('Select at least one meal, then tap Submit.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitEmployeeFoodMeals(mealDate, meals);
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

  const mealMeta = (id: FoodMeal) => FOOD_MEALS.find((m) => m.id === id)!;

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
            <>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 border border-gray-200">
                <button
                  type="button"
                  className={`rounded-lg py-2.5 text-xs font-bold transition-colors ${
                    mode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                  onClick={() => setMode('all')}
                >
                  1. All meals
                </button>
                <button
                  type="button"
                  className={`rounded-lg py-2.5 text-xs font-bold transition-colors ${
                    mode === 'individual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                  onClick={() => {
                    setMode('individual');
                    setStepIndex(0);
                  }}
                >
                  2. One by one
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {mode === 'individual'
                  ? 'Pick each meal separately — tap the 3 items you want for that meal, then Next.'
                  : 'Tap Breakfast / Lunch / Dinner, then Submit once.'}
              </p>
            </>
          )}

          {mode === 'all' && (
            <div className="grid grid-cols-3 gap-3">
              {FOOD_MEALS.map(({ id, label, iconSrc }) => {
                const active = draft[id];
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={locked || submitting}
                    onClick={() => toggleMealAll(id)}
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
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {mode === 'individual' && !locked && !onReviewStep && currentMeal && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src={mealMeta(currentMeal).iconSrc} alt="" className="h-8 w-8 object-contain" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{mealMeta(currentMeal).label}</p>
                  <p className="text-xs text-gray-500">
                    Step {stepIndex + 1} of {MEAL_ORDER.length} · pick any items you want
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {FOOD_MEAL_ITEMS[currentMeal].map((item) => {
                  const active = itemDraft[currentMeal].includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => toggleItem(currentMeal, item.id)}
                      className={`min-h-[5.5rem] rounded-2xl border-2 px-2 py-3 flex flex-col items-center justify-center gap-1 transition-all ${
                        active
                          ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-rose-200'
                      }`}
                    >
                      <span className="text-xs font-bold text-center leading-snug">{item.label}</span>
                      <Te className="text-[10px] mb-0 text-center opacity-80">{item.labelTe}</Te>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {stepIndex > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={goPrevStep}>
                    Back
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={skipMealStep}>
                  Skip this meal
                </Button>
                <Button
                  type="button"
                  className="ml-auto !bg-rose-600 hover:!bg-rose-500"
                  size="sm"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                  onClick={goNextStep}
                >
                  {stepIndex === MEAL_ORDER.length - 1 ? 'Review' : 'Next meal'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'individual' && !locked && onReviewStep && (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <p className="text-sm font-bold text-gray-900">Review your meals</p>
              <ul className="space-y-2 text-sm text-gray-800">
                {MEAL_ORDER.map((meal) => {
                  const on = draft[meal];
                  const items = itemDraft[meal];
                  return (
                    <li key={meal} className="flex justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                      <span className="font-medium">{mealMeta(meal).label}</span>
                      <span className="text-right text-gray-600">
                        {!on ? '—' : items.length ? itemLabelsForMeal(meal, items) : 'Yes'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={() => setStepIndex(0)}>
                Edit from Breakfast
              </Button>
            </div>
          )}

          {(mode === 'all' || onReviewStep) && (
            <Button
              className="w-full !bg-rose-600 hover:!bg-rose-500 focus:ring-rose-500 shadow-sm"
              size="lg"
              disabled={locked || !anySelected || submitting || (mode === 'individual' && !onReviewStep)}
              onClick={() => void handleSubmit()}
            >
              {locked ? 'Submitted' : submitting ? 'Submitting…' : 'Submit'}
            </Button>
          )}

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
