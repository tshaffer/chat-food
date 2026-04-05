import { calculateNutrition, roundNutritionTotals, sumNutrition, type NutritionTotals } from "@shared/nutrition";
import type { Food, LogEntry, Meal } from "@shared/types";

export interface EnrichedLogEntry extends LogEntry {
  food: Food | null;
  nutrition: NutritionTotals;
}

export function enrichLogEntries(entries: LogEntry[], foods: Food[]): EnrichedLogEntry[] {
  const foodsById = new Map(foods.map((food) => [food.id, food]));

  return entries.map((entry) => {
    const food = foodsById.get(entry.foodId) ?? null;
    const nutrition = entry.nutritionSnapshot
      ? entry.nutritionSnapshot
      : food
        ? roundNutritionTotals(calculateNutrition(food, entry.actualAmount))
        : { calories: 0, protein: 0, fiber: 0 };

    return {
      ...entry,
      food,
      nutrition,
    };
  });
}

export function getMealTotals(entries: EnrichedLogEntry[]): NutritionTotals {
  return sumNutrition(entries.map((entry) => entry.nutrition));
}

export function groupEntriesByMeal(entries: EnrichedLogEntry[]): Record<Meal, EnrichedLogEntry[]> {
  return {
    Breakfast: entries.filter((entry) => entry.meal === "Breakfast"),
    Lunch: entries.filter((entry) => entry.meal === "Lunch"),
    Dinner: entries.filter((entry) => entry.meal === "Dinner"),
    Snack: entries.filter((entry) => entry.meal === "Snack"),
  };
}

export interface DailySummary {
  date: string;
  entries: EnrichedLogEntry[];
  totals: NutritionTotals;
}

export function buildDailySummaries(entries: EnrichedLogEntry[]): DailySummary[] {
  const grouped = new Map<string, EnrichedLogEntry[]>();

  entries.forEach((entry) => {
    const existing = grouped.get(entry.date) ?? [];
    existing.push(entry);
    grouped.set(entry.date, existing);
  });

  return [...grouped.entries()]
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      totals: getMealTotals(dayEntries),
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}
