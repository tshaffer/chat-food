import cors from "cors";
import express, { type Response } from "express";
import {
  calculateNutrition,
  roundNutritionTotals,
  roundNutritionValue,
} from "../shared/nutrition.js";
import type {
  AddFromTemplateInput,
  Food,
  FoodInput,
  LogEntry,
  LogEntryInput,
  Meal,
  NutritionSnapshot,
  Template,
  TemplateInput,
  TemplateItem,
  TemplateItemInput,
  User,
  UserInput,
} from "../shared/types.js";
import {
  connectDatabase,
  countFoodReferences,
  createId,
  findFoodById,
  findFoodByNameInsensitive,
  findLogEntryById,
  findTemplateById,
  findUserById,
  findUserByNameInsensitive,
  insertFood,
  insertLogEntries,
  insertLogEntry,
  insertTemplateWithItems,
  insertUser,
  listFoods,
  listLogEntriesForUser,
  listTemplatesForUser,
  listUsers,
  removeFood,
  removeLogEntry,
  removeTemplate,
  updateFood,
  updateLogEntry,
  updateTemplateWithItems,
} from "./store.js";

const port = Number(process.env.PORT ?? 3001);

interface ApiErrorResponse {
  error: {
    message: string;
  };
}

function sendError(response: Response, status: number, message: string) {
  response.status(status).json({ error: { message } } satisfies ApiErrorResponse);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getMeals(): Meal[] {
  return ["Breakfast", "Lunch", "Dinner", "Snack"];
}

function isMeal(value: unknown): value is Meal {
  return typeof value === "string" && getMeals().includes(value as Meal);
}

function validateUserInput(input: unknown): input is UserInput {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  return isNonEmptyString((input as UserInput).name);
}

function validateFoodInput(input: unknown): input is FoodInput {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as FoodInput;

  return (
    isNonEmptyString(candidate.name) &&
    isNonEmptyString(candidate.unitType) &&
    isPositiveNumber(candidate.unitQuantity) &&
    isNonNegativeNumber(candidate.caloriesPerUnit) &&
    isNonNegativeNumber(candidate.proteinPerUnit) &&
    isNonNegativeNumber(candidate.fiberPerUnit)
  );
}

function sanitizeFoodInput(input: FoodInput): FoodInput {
  return {
    name: input.name.trim(),
    unitType: input.unitType.trim(),
    unitQuantity: input.unitQuantity,
    caloriesPerUnit: input.caloriesPerUnit,
    proteinPerUnit: input.proteinPerUnit,
    fiberPerUnit: input.fiberPerUnit,
  };
}

function serializeFood(food: Food) {
  return {
    ...food,
    nutritionPerUnit: {
      calories: roundNutritionValue(food.caloriesPerUnit),
      protein: roundNutritionValue(food.proteinPerUnit),
      fiber: roundNutritionValue(food.fiberPerUnit),
    },
  };
}

function validateLogEntryInput(input: unknown): input is LogEntryInput {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as LogEntryInput;

  return (
    isIsoDateString(candidate.date) &&
    isMeal(candidate.meal) &&
    isNonEmptyString(candidate.foodId) &&
    isPositiveNumber(candidate.actualAmount)
  );
}

function validateTemplateItemInput(input: unknown): input is TemplateItemInput {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as TemplateItemInput;

  return (
    isFiniteNumber(candidate.lineNumber) &&
    Number.isInteger(candidate.lineNumber) &&
    candidate.lineNumber > 0 &&
    isNonEmptyString(candidate.foodId) &&
    isPositiveNumber(candidate.defaultAmount)
  );
}

function validateTemplateInput(input: unknown): input is TemplateInput {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as TemplateInput;

  return (
    isNonEmptyString(candidate.name) &&
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.every(validateTemplateItemInput)
  );
}

function validateAddFromTemplateInput(input: unknown): input is AddFromTemplateInput {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as AddFromTemplateInput;

  return (
    isIsoDateString(candidate.date) &&
    isMeal(candidate.meal) &&
    isNonEmptyString(candidate.templateId) &&
    isPositiveNumber(candidate.multiplier)
  );
}

function normalizeTemplateItems(templateId: string, items: TemplateItemInput[]): TemplateItem[] {
  return [...items]
    .sort((left, right) => left.lineNumber - right.lineNumber)
    .map((item, index) => ({
      id: createId("template_item"),
      templateId,
      lineNumber: index + 1,
      foodId: item.foodId,
      defaultAmount: item.defaultAmount,
    }));
}

function validateTemplateFoods(items: TemplateItemInput[], foods: Food[]): boolean {
  return items.every((item) => foods.some((food) => food.id === item.foodId));
}

function snapshotNutrition(food: Food, actualAmount: number): NutritionSnapshot {
  return roundNutritionTotals(calculateNutrition(food, actualAmount));
}

function createLogEntryRecord(
  userId: string,
  food: Food,
  input: {
    date: string;
    meal: Meal;
    actualAmount: number;
    templateId: string | null;
    templateNameSnapshot: string | null;
  },
): LogEntry {
  const now = new Date().toISOString();
  return {
    id: createId("entry"),
    userId,
    date: input.date,
    meal: input.meal,
    templateId: input.templateId,
    templateNameSnapshot: input.templateNameSnapshot,
    foodId: food.id,
    actualAmount: input.actualAmount,
    nutritionSnapshot: snapshotNutrition(food, input.actualAmount),
    createdAt: now,
    updatedAt: now,
  };
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/users", async (_request, response) => {
    response.json(await listUsers());
  });

  app.post("/api/users", async (request, response) => {
    if (!validateUserInput(request.body)) {
      sendError(response, 400, "A unique username is required.");
      return;
    }

    const name = request.body.name.trim();
    const existing = await findUserByNameInsensitive(name);

    if (existing) {
      sendError(response, 409, "Username must be unique.");
      return;
    }

    const user: User = { id: createId("user"), name };
    response.status(201).json(await insertUser(user));
  });

  app.get("/api/foods", async (_request, response) => {
    response.json((await listFoods()).map(serializeFood));
  });

  app.post("/api/foods", async (request, response) => {
    if (!validateFoodInput(request.body)) {
      sendError(
        response,
        400,
        "Food input is invalid. Name and unit type are required, unit quantity must be greater than 0, and nutrition values cannot be negative.",
      );
      return;
    }

    const input = sanitizeFoodInput(request.body);
    const duplicate = await findFoodByNameInsensitive(input.name);

    if (duplicate) {
      sendError(response, 409, "A food with that name already exists.");
      return;
    }

    const now = new Date().toISOString();
    const food: Food = {
      id: createId("food"),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    response.status(201).json(serializeFood(await insertFood(food)));
  });

  app.put("/api/foods/:id", async (request, response) => {
    if (!validateFoodInput(request.body)) {
      sendError(
        response,
        400,
        "Food input is invalid. Name and unit type are required, unit quantity must be greater than 0, and nutrition values cannot be negative.",
      );
      return;
    }

    const food = await findFoodById(request.params.id);

    if (!food) {
      sendError(response, 404, "Food not found.");
      return;
    }

    const input = sanitizeFoodInput(request.body);
    const duplicate = await findFoodByNameInsensitive(input.name, food.id);

    if (duplicate) {
      sendError(response, 409, "A food with that name already exists.");
      return;
    }

    response.json(
      serializeFood(
        (await updateFood(food.id, {
          ...input,
          updatedAt: new Date().toISOString(),
        }))!,
      ),
    );
  });

  app.delete("/api/foods/:id", async (request, response) => {
    const food = await findFoodById(request.params.id);

    if (!food) {
      sendError(response, 404, "Food not found.");
      return;
    }

    const { templateReferences, logReferences } = await countFoodReferences(request.params.id);

    if (templateReferences || logReferences) {
      const parts = [];
      if (templateReferences) {
        parts.push(`${templateReferences} template item${templateReferences === 1 ? "" : "s"}`);
      }
      if (logReferences) {
        parts.push(`${logReferences} log entr${logReferences === 1 ? "y" : "ies"}`);
      }

      sendError(response, 409, `${food.name} cannot be deleted because it is still used in ${parts.join(" and ")}.`);
      return;
    }

    await removeFood(request.params.id);
    response.status(204).send();
  });

  app.get("/api/users/:userId/templates", async (request, response) => {
    const user = await findUserById(request.params.userId);

    if (!user) {
      sendError(response, 404, "User not found.");
      return;
    }

    response.json(await listTemplatesForUser(request.params.userId));
  });

  app.post("/api/users/:userId/templates", async (request, response) => {
    const user = await findUserById(request.params.userId);

    if (!user) {
      sendError(response, 404, "User not found.");
      return;
    }

    if (!validateTemplateInput(request.body)) {
      sendError(
        response,
        400,
        "Template input is invalid. A template needs a name, at least one item, and each item must have a valid order, food, and amount greater than 0.",
      );
      return;
    }

    const foods = await listFoods();
    if (!validateTemplateFoods(request.body.items, foods)) {
      sendError(response, 400, "Template contains a food that no longer exists.");
      return;
    }

    const now = new Date().toISOString();
    const template: Template = {
      id: createId("template"),
      userId: user.id,
      name: request.body.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const items = normalizeTemplateItems(template.id, request.body.items);

    response.status(201).json(await insertTemplateWithItems(template, items));
  });

  app.put("/api/templates/:id", async (request, response) => {
    const existingTemplate = await findTemplateById(request.params.id);

    if (!existingTemplate) {
      sendError(response, 404, "Template not found.");
      return;
    }

    if (!validateTemplateInput(request.body)) {
      sendError(
        response,
        400,
        "Template input is invalid. A template needs a name, at least one item, and each item must have a valid order, food, and amount greater than 0.",
      );
      return;
    }

    const foods = await listFoods();
    if (!validateTemplateFoods(request.body.items, foods)) {
      sendError(response, 400, "Template contains a food that no longer exists.");
      return;
    }

    const nextTemplate: Template = {
      ...existingTemplate,
      name: request.body.name.trim(),
      updatedAt: new Date().toISOString(),
    };
    const nextItems = normalizeTemplateItems(nextTemplate.id, request.body.items);

    response.json((await updateTemplateWithItems(nextTemplate, nextItems))!);
  });

  app.delete("/api/templates/:id", async (request, response) => {
    const template = await findTemplateById(request.params.id);

    if (!template) {
      sendError(response, 404, "Template not found.");
      return;
    }

    await removeTemplate(request.params.id);
    response.status(204).send();
  });

  app.get("/api/users/:userId/log-entries", async (request, response) => {
    const user = await findUserById(request.params.userId);
    const { date, startDate, endDate } = request.query;

    if (!user) {
      sendError(response, 404, "User not found.");
      return;
    }

    if (
      (typeof date === "string" && !isIsoDateString(date)) ||
      (typeof startDate === "string" && !isIsoDateString(startDate)) ||
      (typeof endDate === "string" && !isIsoDateString(endDate))
    ) {
      sendError(response, 400, "Date filters must use YYYY-MM-DD format.");
      return;
    }

    response.json(
      await listLogEntriesForUser(request.params.userId, {
        date: typeof date === "string" ? date : undefined,
        startDate: typeof startDate === "string" ? startDate : undefined,
        endDate: typeof endDate === "string" ? endDate : undefined,
      }),
    );
  });

  app.post("/api/users/:userId/log-entries", async (request, response) => {
    if (!validateLogEntryInput(request.body)) {
      sendError(
        response,
        400,
        "Log entry input is invalid. Date must use YYYY-MM-DD, meal and food are required, and amount must be greater than 0.",
      );
      return;
    }

    const { date, meal, foodId, actualAmount } = request.body;
    const [user, food] = await Promise.all([findUserById(request.params.userId), findFoodById(foodId)]);

    if (!user) {
      sendError(response, 404, "User not found.");
      return;
    }

    if (!food) {
      sendError(response, 404, "Food not found.");
      return;
    }

    const logEntry = createLogEntryRecord(user.id, food, {
      date,
      meal,
      actualAmount,
      templateId: null,
      templateNameSnapshot: null,
    });

    response.status(201).json(await insertLogEntry(logEntry));
  });

  app.put("/api/log-entries/:id", async (request, response) => {
    const entry = await findLogEntryById(request.params.id);

    if (!entry) {
      sendError(response, 404, "Log entry not found.");
      return;
    }

    if (!validateLogEntryInput(request.body)) {
      sendError(
        response,
        400,
        "Log entry input is invalid. Date must use YYYY-MM-DD, meal and food are required, and amount must be greater than 0.",
      );
      return;
    }

    const { date, meal, foodId, actualAmount } = request.body;
    const food = await findFoodById(foodId);

    if (!food) {
      sendError(response, 404, "Food not found.");
      return;
    }

    response.json(
      (await updateLogEntry(entry.id, {
        date,
        meal,
        foodId,
        actualAmount,
        nutritionSnapshot: snapshotNutrition(food, actualAmount),
        updatedAt: new Date().toISOString(),
      }))!,
    );
  });

  app.delete("/api/log-entries/:id", async (request, response) => {
    const entry = await findLogEntryById(request.params.id);

    if (!entry) {
      sendError(response, 404, "Log entry not found.");
      return;
    }

    await removeLogEntry(request.params.id);
    response.status(204).send();
  });

  app.post("/api/users/:userId/log-entries/from-template", async (request, response) => {
    const user = await findUserById(request.params.userId);

    if (!user) {
      sendError(response, 404, "User not found.");
      return;
    }

    if (!validateAddFromTemplateInput(request.body)) {
      sendError(
        response,
        400,
        "Template logging input is invalid. Date must use YYYY-MM-DD, meal and template are required, and multiplier must be greater than 0.",
      );
      return;
    }

    const template = await findTemplateById(request.body.templateId);

    if (!template || template.userId !== request.params.userId) {
      sendError(response, 404, "Template not found for this user.");
      return;
    }

    const { date, meal, multiplier } = request.body;
    const items = [...template.items].sort((left, right) => left.lineNumber - right.lineNumber);

    if (items.length === 0) {
      sendError(response, 400, "Template must have at least one item before it can be logged.");
      return;
    }

    const foods = await listFoods();
    const foodsById = new Map(foods.map((food) => [food.id, food]));
    const invalidItem = items.find((item) => !foodsById.has(item.foodId));
    if (invalidItem) {
      sendError(response, 400, "Template contains a food that no longer exists.");
      return;
    }

    const createdEntries = items.map((item) => {
      const food = foodsById.get(item.foodId)!;
      return createLogEntryRecord(user.id, food, {
        date,
        meal,
        actualAmount: item.defaultAmount * multiplier,
        templateId: template.id,
        templateNameSnapshot: template.name,
      });
    });

    response.status(201).json(await insertLogEntries(createdEntries));
  });

  return app;
}

const app = createApp();

if (process.env.NODE_ENV !== "test") {
  void connectDatabase()
    .then(() => {
      app.listen(port, () => {
        console.log(`Food Tracker API listening on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error("Failed to connect to MongoDB", error);
      process.exitCode = 1;
    });
}
