import type { Food } from "./types";

export interface NutritionTotals {
  calories: number;
  protein: number;
  fiber: number;
}

export function calculateNutrition(food: Food, actualAmount: number): NutritionTotals {
  const servingsFactor = actualAmount / food.unitQuantity;

  return {
    calories: servingsFactor * food.caloriesPerUnit,
    protein: servingsFactor * food.proteinPerUnit,
    fiber: servingsFactor * food.fiberPerUnit,
  };
}

export function sumNutrition(totals: NutritionTotals[]): NutritionTotals {
  return totals.reduce(
    (accumulator, current) => ({
      calories: accumulator.calories + current.calories,
      protein: accumulator.protein + current.protein,
      fiber: accumulator.fiber + current.fiber,
    }),
    { calories: 0, protein: 0, fiber: 0 },
  );
}

export function roundNutritionValue(value: number): number {
  return Math.round(value * 10) / 10;
}
