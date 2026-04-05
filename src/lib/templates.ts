import { calculateNutrition, roundNutritionValue, sumNutrition, type NutritionTotals } from "@shared/nutrition";
import type { Food, TemplateItem, TemplateItemInput, TemplateWithItems } from "@shared/types";

export interface EnrichedTemplateItem extends TemplateItem {
  food: Food | null;
  nutrition: NutritionTotals;
}

export interface TemplatePreviewRow {
  item: TemplateItem | TemplateItemInput;
  food: Food | null;
  finalAmount: number;
  nutrition: NutritionTotals;
}

export function enrichTemplateItems(items: TemplateItem[], foods: Food[]): EnrichedTemplateItem[] {
  const foodsById = new Map(foods.map((food) => [food.id, food]));

  return items
    .slice()
    .sort((left, right) => left.lineNumber - right.lineNumber)
    .map((item) => {
      const food = foodsById.get(item.foodId) ?? null;
      const nutrition = food
        ? calculateNutrition(food, item.defaultAmount)
        : { calories: 0, protein: 0, fiber: 0 };

      return {
        ...item,
        food,
        nutrition: {
          calories: roundNutritionValue(nutrition.calories),
          protein: roundNutritionValue(nutrition.protein),
          fiber: roundNutritionValue(nutrition.fiber),
        },
      };
    });
}

export function getTemplateTotals(items: Array<{ nutrition: NutritionTotals }>): NutritionTotals {
  return sumNutrition(items.map((item) => item.nutrition));
}

export function buildTemplatePreviewRows(
  template: TemplateWithItems | null,
  foods: Food[],
  multiplier: number,
): TemplatePreviewRow[] {
  if (!template) {
    return [];
  }

  const foodsById = new Map(foods.map((food) => [food.id, food]));

  return template.items
    .slice()
    .sort((left, right) => left.lineNumber - right.lineNumber)
    .map((item) => {
      const food = foodsById.get(item.foodId) ?? null;
      const finalAmount = item.defaultAmount * multiplier;
      const nutrition = food ? calculateNutrition(food, finalAmount) : { calories: 0, protein: 0, fiber: 0 };

      return {
        item,
        food,
        finalAmount,
        nutrition: {
          calories: roundNutritionValue(nutrition.calories),
          protein: roundNutritionValue(nutrition.protein),
          fiber: roundNutritionValue(nutrition.fiber),
        },
      };
    });
}
