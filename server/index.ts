import cors from "cors";
import express from "express";
import { roundNutritionValue } from "../shared/nutrition.js";
import type {
  AddFromTemplateInput,
  Food,
  FoodInput,
  LogEntry,
  LogEntryInput,
  Meal,
  Template,
  TemplateInput,
  TemplateItem,
  TemplateItemInput,
  TemplateWithItems,
  User,
  UserInput,
} from "../shared/types.js";
import { createId, readDatabase, writeDatabase } from "./store.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function badRequest(message: string) {
  return { error: message };
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    isFiniteNumber(candidate.unitQuantity) &&
    isFiniteNumber(candidate.caloriesPerUnit) &&
    isFiniteNumber(candidate.proteinPerUnit) &&
    isFiniteNumber(candidate.fiberPerUnit)
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

function getMeals(): Meal[] {
  return ["Breakfast", "Lunch", "Dinner", "Snack"];
}

function isMeal(value: unknown): value is Meal {
  return typeof value === "string" && getMeals().includes(value as Meal);
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

function buildTemplateResponse(
  template: Template,
  templateItems: TemplateItem[],
): TemplateWithItems {
  return {
    ...template,
    items: templateItems
      .filter((item) => item.templateId === template.id)
      .sort((left, right) => left.lineNumber - right.lineNumber),
  };
}

function normalizeTemplateItems(
  templateId: string,
  items: TemplateItemInput[],
): TemplateItem[] {
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

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/users", async (_request, response) => {
  const database = await readDatabase();
  response.json(database.users);
});

app.post("/api/users", async (request, response) => {
  if (!validateUserInput(request.body)) {
    response.status(400).json(badRequest("A unique username is required."));
    return;
  }

  const database = await readDatabase();
  const name = request.body.name.trim();
  const existing = database.users.find((user) => user.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    response.status(409).json(badRequest("Username must be unique."));
    return;
  }

  const user: User = { id: createId("user"), name };
  database.users.push(user);
  await writeDatabase(database);
  response.status(201).json(user);
});

app.get("/api/foods", async (_request, response) => {
  const database = await readDatabase();
  response.json(database.foods.map(serializeFood));
});

app.post("/api/foods", async (request, response) => {
  if (!validateFoodInput(request.body)) {
    response.status(400).json(badRequest("Food input is invalid."));
    return;
  }

  const input = sanitizeFoodInput(request.body);
  const now = new Date().toISOString();
  const database = await readDatabase();

  const food: Food = {
    id: createId("food"),
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  database.foods.push(food);
  await writeDatabase(database);
  response.status(201).json(serializeFood(food));
});

app.put("/api/foods/:id", async (request, response) => {
  if (!validateFoodInput(request.body)) {
    response.status(400).json(badRequest("Food input is invalid."));
    return;
  }

  const database = await readDatabase();
  const food = database.foods.find((item) => item.id === request.params.id);

  if (!food) {
    response.status(404).json(badRequest("Food not found."));
    return;
  }

  Object.assign(food, sanitizeFoodInput(request.body), {
    updatedAt: new Date().toISOString(),
  });

  await writeDatabase(database);
  response.json(serializeFood(food));
});

app.delete("/api/foods/:id", async (request, response) => {
  const database = await readDatabase();
  const isReferencedByTemplate = database.templateItems.some((item) => item.foodId === request.params.id);
  const isReferencedByLog = database.logEntries.some((item) => item.foodId === request.params.id);

  if (isReferencedByTemplate || isReferencedByLog) {
    response.status(409).json(badRequest("Food cannot be deleted because it is in use."));
    return;
  }

  const nextFoods = database.foods.filter((food) => food.id !== request.params.id);

  if (nextFoods.length === database.foods.length) {
    response.status(404).json(badRequest("Food not found."));
    return;
  }

  database.foods = nextFoods;
  await writeDatabase(database);
  response.status(204).send();
});

app.get("/api/users/:userId/templates", async (request, response) => {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === request.params.userId);

  if (!user) {
    response.status(404).json(badRequest("User not found."));
    return;
  }

  const templates = database.templates
    .filter((template) => template.userId === request.params.userId)
    .map((template) => buildTemplateResponse(template, database.templateItems));

  response.json(templates);
});

app.post("/api/users/:userId/templates", async (request, response) => {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === request.params.userId);

  if (!user) {
    response.status(404).json(badRequest("User not found."));
    return;
  }

  if (!validateTemplateInput(request.body)) {
    response.status(400).json(badRequest("Template input is invalid."));
    return;
  }

  if (!validateTemplateFoods(request.body.items, database.foods)) {
    response.status(400).json(badRequest("Template contains an invalid food."));
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

  database.templates.push(template);
  database.templateItems.push(...items);
  await writeDatabase(database);
  response.status(201).json(buildTemplateResponse(template, items));
});

app.put("/api/templates/:id", async (request, response) => {
  const database = await readDatabase();
  const template = database.templates.find((item) => item.id === request.params.id);

  if (!template) {
    response.status(404).json(badRequest("Template not found."));
    return;
  }

  if (!validateTemplateInput(request.body)) {
    response.status(400).json(badRequest("Template input is invalid."));
    return;
  }

  if (!validateTemplateFoods(request.body.items, database.foods)) {
    response.status(400).json(badRequest("Template contains an invalid food."));
    return;
  }

  template.name = request.body.name.trim();
  template.updatedAt = new Date().toISOString();
  const nextItems = normalizeTemplateItems(template.id, request.body.items);

  database.templateItems = database.templateItems.filter((item) => item.templateId !== template.id);
  database.templateItems.push(...nextItems);
  await writeDatabase(database);
  response.json(buildTemplateResponse(template, nextItems));
});

app.delete("/api/templates/:id", async (request, response) => {
  const database = await readDatabase();
  const nextTemplates = database.templates.filter((template) => template.id !== request.params.id);

  if (nextTemplates.length === database.templates.length) {
    response.status(404).json(badRequest("Template not found."));
    return;
  }

  database.templates = nextTemplates;
  database.templateItems = database.templateItems.filter((item) => item.templateId !== request.params.id);
  await writeDatabase(database);
  response.status(204).send();
});

app.get("/api/users/:userId/log-entries", async (request, response) => {
  const database = await readDatabase();
  const { date, startDate, endDate } = request.query;
  const user = database.users.find((item) => item.id === request.params.userId);

  if (!user) {
    response.status(404).json(badRequest("User not found."));
    return;
  }

  if (
    (typeof date === "string" && !isIsoDateString(date)) ||
    (typeof startDate === "string" && !isIsoDateString(startDate)) ||
    (typeof endDate === "string" && !isIsoDateString(endDate))
  ) {
    response.status(400).json(badRequest("Date filters must use YYYY-MM-DD format."));
    return;
  }

  const entries = database.logEntries.filter((entry) => {
    if (entry.userId !== request.params.userId) {
      return false;
    }

    if (typeof date === "string" && entry.date !== date) {
      return false;
    }

    if (typeof startDate === "string" && entry.date < startDate) {
      return false;
    }

    if (typeof endDate === "string" && entry.date > endDate) {
      return false;
    }

    return true;
  });

  response.json(entries);
});

app.post("/api/users/:userId/log-entries", async (request, response) => {
  const database = await readDatabase();
  if (!validateLogEntryInput(request.body)) {
    response.status(400).json(badRequest("Log entry input is invalid."));
    return;
  }

  const { date, meal, foodId, actualAmount } = request.body;

  const user = database.users.find((item) => item.id === request.params.userId);
  const food = database.foods.find((item) => item.id === foodId);

  if (!user || !food) {
    response.status(404).json(badRequest("User or food not found."));
    return;
  }

  const now = new Date().toISOString();
  const logEntry: LogEntry = {
    id: createId("entry"),
    userId: user.id,
    date,
    meal,
    templateId: null,
    templateNameSnapshot: null,
    foodId: food.id,
    actualAmount,
    createdAt: now,
    updatedAt: now,
  };

  database.logEntries.push(logEntry);
  await writeDatabase(database);
  response.status(201).json(logEntry);
});

app.put("/api/log-entries/:id", async (request, response) => {
  const database = await readDatabase();
  const entry = database.logEntries.find((item) => item.id === request.params.id);

  if (!entry) {
    response.status(404).json(badRequest("Log entry not found."));
    return;
  }

  if (!validateLogEntryInput(request.body)) {
    response.status(400).json(badRequest("Log entry input is invalid."));
    return;
  }

  const { date, meal, foodId, actualAmount } = request.body;

  const food = database.foods.find((item) => item.id === foodId);
  if (!food) {
    response.status(404).json(badRequest("Food not found."));
    return;
  }

  entry.date = date;
  entry.meal = meal;
  entry.foodId = foodId;
  entry.actualAmount = actualAmount;
  entry.updatedAt = new Date().toISOString();

  await writeDatabase(database);
  response.json(entry);
});

app.delete("/api/log-entries/:id", async (request, response) => {
  const database = await readDatabase();
  const nextEntries = database.logEntries.filter((entry) => entry.id !== request.params.id);

  if (nextEntries.length === database.logEntries.length) {
    response.status(404).json(badRequest("Log entry not found."));
    return;
  }

  database.logEntries = nextEntries;
  await writeDatabase(database);
  response.status(204).send();
});

app.post("/api/users/:userId/log-entries/from-template", async (request, response) => {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === request.params.userId);
  const template = database.templates.find((item) => item.id === request.body?.templateId && item.userId === request.params.userId);

  if (!user || !template) {
    response.status(404).json(badRequest("User or template not found."));
    return;
  }

  if (!validateAddFromTemplateInput(request.body)) {
    response.status(400).json(badRequest("Template logging input is invalid."));
    return;
  }

  const { date, meal, multiplier } = request.body;
  const items = database.templateItems
    .filter((item) => item.templateId === template.id)
    .sort((left, right) => left.lineNumber - right.lineNumber);

  if (items.length === 0) {
    response.status(400).json(badRequest("Template must have at least one item."));
    return;
  }

  const hasInvalidFood = items.some((item) => !database.foods.some((food) => food.id === item.foodId));
  if (hasInvalidFood) {
    response.status(400).json(badRequest("Template contains an invalid food."));
    return;
  }

  const now = new Date().toISOString();
  const createdEntries = items.map(
    (item): LogEntry => ({
      id: createId("entry"),
      userId: user.id,
      date,
      meal,
      templateId: template.id,
      templateNameSnapshot: template.name,
      foodId: item.foodId,
      actualAmount: item.defaultAmount * multiplier,
      createdAt: now,
      updatedAt: now,
    }),
  );

  database.logEntries.push(...createdEntries);
  await writeDatabase(database);
  response.status(201).json(createdEntries);
});

app.listen(port, () => {
  console.log(`Food Tracker API listening on http://localhost:${port}`);
});
