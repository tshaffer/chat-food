export type Meal = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface User {
  id: string;
  name: string;
}

export interface Food {
  id: string;
  name: string;
  unitQuantity: number;
  unitType: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  fiberPerUnit: number;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateItem {
  id: string;
  templateId: string;
  lineNumber: number;
  foodId: string;
  defaultAmount: number;
}

export interface LogEntry {
  id: string;
  userId: string;
  date: string;
  meal: Meal;
  templateId: string | null;
  templateNameSnapshot: string | null;
  foodId: string;
  actualAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  users: User[];
  foods: Food[];
  templates: Template[];
  templateItems: TemplateItem[];
  logEntries: LogEntry[];
}

export interface FoodInput {
  name: string;
  unitQuantity: number;
  unitType: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  fiberPerUnit: number;
}

export interface UserInput {
  name: string;
}

export interface LogEntryInput {
  date: string;
  meal: Meal;
  foodId: string;
  actualAmount: number;
}

export const meals: Meal[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
