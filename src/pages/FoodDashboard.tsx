import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { foodBoardRows, isFoodSelectionSubmitted, mealCountForDay, FOOD_MEALS, shiftMealDateKey } from '../lib/food';
import { getISTDateKey } from '../lib/attendance';
import { filterAttendanceStaff } from '../lib/staff';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';

export const FoodDashboard: React.FC = () => {
  const employees = useStore((s) => s.employees);
  const foodSelections = useStore((s) => s.foodSelections);
  const loadFoodSelectionsWindow = useStore((s) => s.loadFoodSelectionsWindow);
  const viewMode = useStore((s) => s.viewMode);

  const [mealDate, setMealDate] = useState(() => getISTDateKey());
  const [refreshing, setRefreshing] = useState(false);

  const staff = useMemo(
    () => filterAttendanceStaff(employees).filter((e) => e.role === 'employee'),
    [employees],
  );

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

  const submittedCount = rows.filter(
    (r) =>
      isFoodSelectionSubmitted(r.selection) &&
      (r.selection.breakfast || r.selection.lunch || r.selection.dinner),
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

  const today = getISTDateKey();
  const dayLabel =
    mealDate === today
      ? 'Today'
      : mealDate === shiftMealDateKey(today, -1)
        ? 'Yesterday'
        : mealDate;

  return (
    <NexusPage maxWidthClass="max-w-[1200px]" className="space-y-5">
      <NexusPageHeader
        title="Food"
        description={`Meal selections for ${dayLabel} · ${submittedCount} submitted`}
        actions={
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
        }
      />

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
        {submittedCount} of {rows.length} employees submitted for {dayLabel.toLowerCase()}. Employees choose meals in
        their app — this page is view only.
      </p>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Breakfast</th>
                <th className="px-4 py-3 text-center">Lunch</th>
                <th className="px-4 py-3 text-center">Dinner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ employee, selection }) => {
                const submitted = isFoodSelectionSubmitted(selection);
                const statusLabel = submitted ? 'Submitted' : 'Pending';
                const statusClass = submitted
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
                      const on = submitted && selection[m.id];
                      return (
                        <td key={m.id} className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md text-xs font-bold ${
                              on ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-300'
                            }`}
                          >
                            {on ? '✓' : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </NexusPage>
  );
};
