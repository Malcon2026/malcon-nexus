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

export const FOOD_MEALS: { id: FoodMeal; label: string; iconSrc: string }[] = [
  { id: 'breakfast', label: 'Breakfast', iconSrc: '/food/breakfast.svg' },
  { id: 'lunch', label: 'Lunch', iconSrc: '/food/lunch.svg' },
  { id: 'dinner', label: 'Dinner', iconSrc: '/food/dinner.svg' },
];

/** Three canteen choices per meal — pick individually in “One by one” mode. */
export const FOOD_MEAL_ITEMS: Record<
  FoodMeal,
  { id: string; label: string; labelTe: string }[]
> = {
  breakfast: [
    { id: 'bf_tiffin', label: 'Tiffin', labelTe: 'Tiffin' },
    { id: 'bf_tea', label: 'Tea / coffee', labelTe: 'Tea / coffee' },
    { id: 'bf_egg', label: 'Egg', labelTe: 'Egg' },
  ],
  lunch: [
    { id: 'ln_veg', label: 'Veg meal', labelTe: 'Veg meal' },
    { id: 'ln_egg', label: 'Egg meal', labelTe: 'Egg meal' },
    { id: 'ln_curd', label: 'Curd rice', labelTe: 'Curd rice' },
  ],
  dinner: [
    { id: 'dn_veg', label: 'Veg meal', labelTe: 'Veg meal' },
    { id: 'dn_chapati', label: 'Chapati meal', labelTe: 'Chapati meal' },
    { id: 'dn_light', label: 'Light meal', labelTe: 'Light meal' },
  ],
};

export function mealEnabledFromItems(itemIds: string[]): boolean {
  return itemIds.length > 0;
}

export function itemLabelsForMeal(meal: FoodMeal, itemIds: string[]): string {
  const map = new Map(FOOD_MEAL_ITEMS[meal].map((i) => [i.id, i.label]));
  return itemIds.map((id) => map.get(id) ?? id).join(', ');
}

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
