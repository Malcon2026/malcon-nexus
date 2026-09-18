import type { EmployeeFoodSelection, FoodMeal } from '../types';
import { FOOD_MEALS } from './food';

export type FoodMealToken = {
  code: string;
  employeeName: string;
  mealDate: string;
  meals: FoodMeal[];
  submittedAt: string;
};

export function buildFoodMealToken(
  selection: EmployeeFoodSelection,
  employeeName: string,
): FoodMealToken {
  const day = selection.mealDate.replace(/-/g, '');
  const tail = selection.id.replace(/-/g, '').slice(0, 4).toUpperCase();
  const meals = FOOD_MEALS.filter((m) => selection[m.id]).map((m) => m.id);
  return {
    code: `MFD-${day}-${tail}`,
    employeeName,
    mealDate: selection.mealDate,
    meals,
    submittedAt: selection.submittedAt ?? selection.updatedAt,
  };
}

export function mealLabelsForToken(meals: FoodMeal[]): string {
  const map = Object.fromEntries(FOOD_MEALS.map((m) => [m.id, m.label])) as Record<FoodMeal, string>;
  return meals.map((id) => map[id]).join(' · ');
}
