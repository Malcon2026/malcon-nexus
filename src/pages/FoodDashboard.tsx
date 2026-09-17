import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { foodBoardRows, isFoodSelectionSubmitted, mealCountForDay, FOOD_MEALS, shiftMealDateKey } from '../lib/food';
import { getISTDateKey } from '../lib/attendance';
import { filterAttendanceStaff } from '../lib/staff';
import { EmployeeFoodSection } from '../components/EmployeeFoodSection';
import type { Employee } from '../types';
import type { FoodMeal } from '../types';

function formatDayHeading(dateKey: string): string {
  const today = getISTDateKey();
  const base =
    dateKey === today
      ? 'Today'
      : dateKey === shiftMealDateKey(today, -1)
        ? 'Yesterday'
        : null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const long = dt.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return base ? `${base} · ${long}` : long;
}

const emptyMeals = (): Record<FoodMeal, boolean> => ({
  breakfast: false,
  lunch: false,
  dinner: false,
});

function mealsFromSelection(
  submitted: boolean,
  selection: Record<FoodMeal, boolean>,
): Record<FoodMeal, boolean> {
  if (!submitted) return emptyMeals();
  return {
    breakfast: selection.breakfast,
    lunch: selection.lunch,
    dinner: selection.dinner,
  };
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
  const [applyingId, setApplyingId] = useState<string | null>(null);
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
      next[employee.id] = mealsFromSelection(isFoodSelectionSubmitted(selection), selection);
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

  const selectedAny = rows.filter(
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

  const applyForEmployee = async (employee: Employee) => {
    const draft = drafts[employee.id] ?? emptyMeals();
    setRowError(null);
    setApplyingId(employee.id);
    try {
      const result = await submitFoodMealsAsAdmin(employee.id, mealDate, draft);
      if (result.error) setRowError(result.error);
    } finally {
      setApplyingId(null);
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

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full min-w-0 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-rose-600" />
            Food
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDayHeading(mealDate)}</p>
        </div>
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

      <EmployeeFoodSection mealDate={mealDate} embedded />

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

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => setMealDate((d) => shiftMealDateKey(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm text-gray-600">
          {selectedAny} of {rows.length} staff submitted at least one meal
        </p>
        <button
          type="button"
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => setMealDate((d) => shiftMealDateKey(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {rowError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{rowError}</p>
      )}

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 text-center">Breakfast</th>
                <th className="px-4 py-3 text-center">Lunch</th>
                <th className="px-4 py-3 text-center">Dinner</th>
                <th className="px-4 py-3 text-right">Apply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ employee, selection }) => {
                const submitted = isFoodSelectionSubmitted(selection);
                const draft = drafts[employee.id] ?? emptyMeals();
                const anyDraft = draft.breakfast || draft.lunch || draft.dinner;
                const busy = applyingId === employee.id;
                return (
                  <tr key={employee.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {employee.name}
                      {employee.role === 'admin' && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-gray-400">Admin</span>
                      )}
                      {submitted && (
                        <span className="block text-[11px] font-normal text-emerald-600">Submitted</span>
                      )}
                    </td>
                    {FOOD_MEALS.map((m) => {
                      const on = draft[m.id];
                      return (
                        <td key={m.id} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleDraft(employee.id, m.id)}
                            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                              on
                                ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            aria-label={`${employee.name} ${m.label}`}
                          >
                            {on ? '✓' : '+'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!anyDraft || busy}
                        onClick={() => void applyForEmployee(employee)}
                      >
                        {busy ? '…' : submitted ? 'Update' : 'Apply'}
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
