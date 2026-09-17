import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { foodBoardRows, mealCountForDay, FOOD_MEALS, shiftMealDateKey } from '../lib/food';
import { getISTDateKey } from '../lib/attendance';
import { filterAttendanceStaff } from '../lib/staff';

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

export const FoodDashboard: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const foodSelections = useStore((s) => s.foodSelections);
  const loadFoodSelectionsWindow = useStore((s) => s.loadFoodSelectionsWindow);
  const viewMode = useStore((s) => s.viewMode);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);

  const staff = useMemo(() => filterAttendanceStaff(employees), [employees]);

  useEffect(() => {
    void loadFoodSelectionsWindow(mealDate);
  }, [mealDate, loadFoodSelectionsWindow]);

  const rows = useMemo(
    () => foodBoardRows(staff, foodSelections, mealDate),
    [staff, foodSelections, mealDate],
  );

  const counts = useMemo(
    () =>
      FOOD_MEALS.map((m) => ({
        ...m,
        count: mealCountForDay(foodSelections, mealDate, m.id),
      })),
    [foodSelections, mealDate],
  );

  const selectedAny = rows.filter(
    (r) => r.selection.breakfast || r.selection.lunch || r.selection.dinner,
  ).length;

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
          {selectedAny} of {rows.length} staff selected at least one meal
        </p>
        <button
          type="button"
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => setMealDate((d) => shiftMealDateKey(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 text-center">Breakfast</th>
                <th className="px-4 py-3 text-center">Lunch</th>
                <th className="px-4 py-3 text-center">Dinner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ employee, selection }) => (
                <tr key={employee.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 font-medium text-gray-900">{employee.name}</td>
                  {FOOD_MEALS.map((m) => {
                    const on = selection[m.id];
                    return (
                      <td key={m.id} className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md text-xs font-bold ${
                            on ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-300'
                          }`}
                        >
                          {on ? '✓' : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
};
