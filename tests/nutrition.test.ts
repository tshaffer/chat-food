import test from "node:test";
import assert from "node:assert/strict";
import { calculateNutrition, roundNutritionTotals } from "../shared/nutrition.js";
import type { Food } from "../shared/types.js";

test("nutrition calculations scale from the food unit quantity", () => {
  const food: Food = {
    id: "food_1",
    name: "Greek Yogurt",
    unitQuantity: 170,
    unitType: "g",
    caloriesPerUnit: 100,
    proteinPerUnit: 17,
    fiberPerUnit: 0,
    createdAt: "",
    updatedAt: "",
  };

  const nutrition = calculateNutrition(food, 255);

  assert.deepEqual(roundNutritionTotals(nutrition), {
    calories: 150,
    protein: 25.5,
    fiber: 0,
  });
});
