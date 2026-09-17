import type { Employee, EmployeeFoodSelection, FoodMeal } from '../types';
import { isAttendanceStaff } from './staff';
export function shiftMealDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function foodLoadWindow(centerDate: string): { from: string; to: string } {
  return {
    from: shiftMealDateKey(centerDate, -45),
    to: shiftMealDateKey(centerDate, 45),
  };
}

export const FOOD_MEALS: { id: FoodMeal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];

export function emptyFoodSelection(
  employeeId: string,
  employeeName: string,
  mealDate: string,
): EmployeeFoodSelection {
  const now = new Date().toISOString();
  return {
    id: '',
    employeeId,
    employeeName,
    mealDate,
    breakfast: false,
    lunch: false,
    dinner: false,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function isFoodSelectionSubmitted(selection: EmployeeFoodSelection | undefined): boolean {
  return Boolean(selection?.submittedAt);
}

export function getFoodSelectionForDay(
  selections: EmployeeFoodSelection[],
  employeeId: string,
  mealDate: string,
): EmployeeFoodSelection | undefined {
  return selections.find((s) => s.employeeId === employeeId && s.mealDate === mealDate);
}

export function mealCountForDay(
  selections: EmployeeFoodSelection[],
  mealDate: string,
  meal: FoodMeal,
): number {
  return selections.filter(
    (s) => s.mealDate === mealDate && isFoodSelectionSubmitted(s) && s[meal],
  ).length;
}

export function selectionsForDate(
  selections: EmployeeFoodSelection[],
  mealDate: string,
): EmployeeFoodSelection[] {
  return selections.filter((s) => s.mealDate === mealDate);
}

/** Merge staff list with selections so admin sees everyone for the day. */
export function foodBoardRows(
  employees: Employee[],
  selections: EmployeeFoodSelection[],
  mealDate: string,
): Array<{
  employee: Employee;
  selection: EmployeeFoodSelection;
}> {
  const byEmployee = new Map(
    selectionsForDate(selections, mealDate).map((s) => [s.employeeId, s]),
  );
  return employees
    .filter(isAttendanceStaff)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((employee) => {
      const existing = byEmployee.get(employee.id);
      return {
        employee,
        selection:
          existing ??
          emptyFoodSelection(employee.id, employee.name, mealDate),
      };
    });
}
