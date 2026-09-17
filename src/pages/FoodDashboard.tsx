import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { foodBoardRows, isFoodSelectionSubmitted, mealCountForDay, FOOD_MEALS, shiftMealDateKey } from '../lib/food';
import { getISTDateKey } from '../lib/attendance';
import { filterAttendanceStaff } from '../lib/staff';
import type { Employee, EmployeeFoodSelection } from '../types';
import type { FoodMeal } from '../types';

const emptyMeals = (): Record<FoodMeal, boolean> => ({
  breakfast: false,
  lunch: false,
  dinner: false,
});

function savedMeals(selection: EmployeeFoodSelection): Record<FoodMeal, boolean> {
  return {
    breakfast: selection.breakfast,
    lunch: selection.lunch,
    dinner: selection.dinner,
  };
}

function mealsEqual(a: Record<FoodMeal, boolean>, b: Record<FoodMeal, boolean>): boolean {
  return a.breakfast === b.breakfast && a.lunch === b.lunch && a.dinner === b.dinner;
}

export const FoodDashboard: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const foodSelections = useStore((s) => s.foodSelections);
  const loadFoodSelectionsWindow = useStore((s) => s.loadFoodSelectionsWindow);
  const submitFoodMealsAsAdmin = useStore((s) => s.submitFoodMealsAsAdmin);
  const viewMode = useStore((s) => s.viewMode);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Record<FoodMeal, boolean>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const staff = useMemo(() => filterAttendanceStaff(employees), [employees]);

  useEffect(() => {
    void loadFoodSelectionsWindow(mealDate);
  }, [mealDate, loadFoodSelectionsWindow]);

  const rows = useMemo(
    () => foodBoardRows(staff, foodSelections, mealDate),
    [staff, foodSelections, mealDate],
  );

  useEffect(() => {
    const next: Record<string, Record<FoodMeal, boolean>> = {};
    for (const { employee, selection } of rows) {
      next[employee.id] = isFoodSelectionSubmitted(selection)
        ? savedMeals(selection)
        : emptyMeals();
    }
    setDrafts(next);
    setRowError(null);
  }, [rows, mealDate]);

  const counts = useMemo(
    () =>
      FOOD_MEALS.map((m) => ({
        ...m,
        count: mealCountForDay(foodSelections, mealDate, m.id),
      })),
    [foodSelections, mealDate],
  );

  const savedCount = rows.filter(
    (r) =>
      isFoodSelectionSubmitted(r.selection) &&
      (r.selection.breakfast || r.selection.lunch || r.selection.dinner),
  ).length;

  const toggleDraft = useCallback((employeeId: string, meal: FoodMeal) => {
    setRowError(null);
    setDrafts((prev) => {
      const current = prev[employeeId] ?? emptyMeals();
      return { ...prev, [employeeId]: { ...current, [meal]: !current[meal] } };
    });
  }, []);

  const saveForEmployee = async (employee: Employee) => {
    const draft = drafts[employee.id] ?? emptyMeals();
    setRowError(null);
    setSavingId(employee.id);
    try {
      const result = await submitFoodMealsAsAdmin(employee.id, mealDate, draft);
      if (result.error) setRowError(result.error);
    } finally {
      setSavingId(null);
    }
  };

  if (viewMode !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20 text-center text-sm text-gray-500">
        Admin access required.
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFoodSelectionsWindow(mealDate, { force: true });
    } finally {
      setRefreshing(false);
    }
  };

  const today = getISTDateKey();
  const dayLabel =
    mealDate === today
      ? 'Today'
      : mealDate === shiftMealDateKey(today, -1)
        ? 'Yesterday'
        : mealDate;

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full min-w-0 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <UtensilsCrossed className="h-5 w-5 text-rose-600 shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Food</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Previous day"
            onClick={() => setMealDate((d) => shiftMealDateKey(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[5.5rem] text-center">{dayLabel}</span>
          <button
            type="button"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Next day"
            onClick={() => setMealDate((d) => shiftMealDateKey(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {counts.map((c) => (
          <Card key={c.id}>
            <CardBody className="py-3 text-center">
              <p className="text-xs font-medium text-gray-500">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">{c.count}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-sm text-gray-600">
        {savedCount} of {rows.length} people saved for this day. Tap B / L / D, then <span className="font-semibold">Save</span>{' '}
        on that row.
      </p>

      {rowError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{rowError}</p>
      )}

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">B</th>
                <th className="px-4 py-3 text-center">L</th>
                <th className="px-4 py-3 text-center">D</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ employee, selection }) => {
                const saved = isFoodSelectionSubmitted(selection);
                const draft = drafts[employee.id] ?? emptyMeals();
                const baseline = saved ? savedMeals(selection) : emptyMeals();
                const anyDraft = draft.breakfast || draft.lunch || draft.dinner;
                const dirty = !mealsEqual(draft, baseline);
                const busy = savingId === employee.id;
                const statusLabel = saved ? 'Saved' : 'Pending';
                const statusClass = saved
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-gray-100 text-gray-600';

                return (
                  <tr key={employee.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{employee.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    {FOOD_MEALS.map((m) => {
                      const on = draft[m.id];
                      return (
                        <td key={m.id} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleDraft(employee.id, m.id)}
                            title={m.label}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                              on
                                ? 'bg-rose-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {on ? '✓' : '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        disabled={!anyDraft || !dirty || busy}
                        onClick={() => void saveForEmployee(employee)}
                      >
                        {busy ? 'Saving…' : 'Save'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
};
