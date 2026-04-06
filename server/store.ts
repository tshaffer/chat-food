import mongoose from "mongoose";
import { calculateNutrition, roundNutritionTotals } from "../shared/nutrition.js";
import type {
  Database,
  Food,
  LogEntry,
  NutritionSnapshot,
  Template,
  TemplateItem,
  TemplateWithItems,
  User,
} from "../shared/types.js";
import {
  FoodModel,
  LogEntryModel,
  TemplateItemModel,
  TemplateModel,
  UserModel,
} from "./models.js";

let writeChain: Promise<void> = Promise.resolve();
let connectionPromise: Promise<typeof mongoose> | null = null;
let connectedKey = "";

type UserRecord = {
  id: string;
  name: string;
};

type FoodRecord = {
  id: string;
  name: string;
  unitQuantity: number;
  unitType: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  fiberPerUnit: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type TemplateRecord = {
  id: string;
  userId: string;
  name: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type TemplateItemRecord = {
  id: string;
  templateId: string;
  lineNumber: number;
  foodId: string;
  defaultAmount: number;
};

type LogEntryRecord = {
  id: string;
  userId: string;
  date: string;
  meal: LogEntry["meal"];
  templateId: string | null;
  templateNameSnapshot: string | null;
  foodId: string;
  actualAmount: number;
  nutritionSnapshot?: NutritionSnapshot | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export interface LogEntryFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
}

function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? "food-tracker";

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required. Configure it with your MongoDB Atlas connection string before starting the server or running seed/import commands.",
    );
  }

  return { uri, dbName };
}

function makeConnectionKey(uri: string, dbName: string): string {
  return `${uri}::${dbName}`;
}

function extractDbNameFromUri(uri: string): string | null {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\//, "");
    return pathname || null;
  } catch {
    return null;
  }
}

function asIsoString(value: Date | string | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUser(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
  };
}

function toFood(record: FoodRecord): Food {
  return {
    id: record.id,
    name: record.name,
    unitQuantity: record.unitQuantity,
    unitType: record.unitType,
    caloriesPerUnit: record.caloriesPerUnit,
    proteinPerUnit: record.proteinPerUnit,
    fiberPerUnit: record.fiberPerUnit,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
  };
}

function toTemplate(record: TemplateRecord): Template {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
  };
}

function toTemplateItem(record: TemplateItemRecord): TemplateItem {
  return {
    id: record.id,
    templateId: record.templateId,
    lineNumber: record.lineNumber,
    foodId: record.foodId,
    defaultAmount: record.defaultAmount,
  };
}

function createFallbackNutritionSnapshot(food: FoodRecord | undefined, actualAmount: number): NutritionSnapshot {
  if (!food) {
    return { calories: 0, protein: 0, fiber: 0 };
  }

  return roundNutritionTotals(calculateNutrition(toFood(food), actualAmount));
}

function toLogEntry(record: LogEntryRecord, fallbackSnapshot?: NutritionSnapshot): LogEntry {
  return {
    id: record.id,
    userId: record.userId,
    date: record.date,
    meal: record.meal,
    templateId: record.templateId,
    templateNameSnapshot: record.templateNameSnapshot,
    foodId: record.foodId,
    actualAmount: record.actualAmount,
    nutritionSnapshot: record.nutritionSnapshot ?? fallbackSnapshot ?? { calories: 0, protein: 0, fiber: 0 },
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
  };
}

function buildTemplateWithItems(template: Template, items: TemplateItem[]): TemplateWithItems {
  return {
    ...template,
    items: [...items].sort((left, right) => left.lineNumber - right.lineNumber),
  };
}

async function normalizeLogEntryRecords(records: LogEntryRecord[]): Promise<LogEntry[]> {
  const missingFoodIds = [...new Set(records.filter((record) => !record.nutritionSnapshot).map((record) => record.foodId))];

  let foodsById = new Map<string, FoodRecord>();
  if (missingFoodIds.length > 0) {
    const foods = await FoodModel.find({ id: { $in: missingFoodIds } }).lean<FoodRecord[]>().exec();
    foodsById = new Map(foods.map((food) => [food.id, food]));
  }

  return records.map((record) =>
    toLogEntry(
      record,
      record.nutritionSnapshot ? undefined : createFallbackNutritionSnapshot(foodsById.get(record.foodId), record.actualAmount),
    ),
  );
}

export async function connectDatabase(): Promise<typeof mongoose> {
  const { uri, dbName } = getMongoConfig();
  const connectionKey = makeConnectionKey(uri, dbName);

  if (mongoose.connection.readyState === 1 && connectedKey === connectionKey) {
    return mongoose;
  }

  if (connectionPromise && connectedKey === connectionKey) {
    return connectionPromise;
  }

  if (mongoose.connection.readyState !== 0 && connectedKey !== connectionKey) {
    await mongoose.disconnect();
    connectionPromise = null;
  }

  connectedKey = connectionKey;
  connectionPromise = mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME ? dbName : extractDbNameFromUri(uri) ?? dbName,
    autoIndex: true,
  });

  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  connectionPromise = null;
  connectedKey = "";

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function listUsers(): Promise<User[]> {
  await connectDatabase();
  const users = await UserModel.find().sort({ name: 1, id: 1 }).lean<UserRecord[]>().exec();
  return users.map(toUser);
}

export async function findUserById(id: string): Promise<User | null> {
  await connectDatabase();
  const user = await UserModel.findOne({ id }).lean<UserRecord | null>().exec();
  return user ? toUser(user) : null;
}

export async function findUserByNameInsensitive(name: string): Promise<User | null> {
  await connectDatabase();
  const user = await UserModel.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") })
    .lean<UserRecord | null>()
    .exec();
  return user ? toUser(user) : null;
}

export async function insertUser(user: User): Promise<User> {
  await connectDatabase();
  const created = await UserModel.create({
    id: user.id,
    name: user.name,
  });
  return toUser(created.toObject() as UserRecord);
}

export async function listFoods(): Promise<Food[]> {
  await connectDatabase();
  const foods = await FoodModel.find().sort({ name: 1, id: 1 }).lean<FoodRecord[]>().exec();
  return foods.map(toFood);
}

export async function findFoodById(id: string): Promise<Food | null> {
  await connectDatabase();
  const food = await FoodModel.findOne({ id }).lean<FoodRecord | null>().exec();
  return food ? toFood(food) : null;
}

export async function findFoodByNameInsensitive(name: string, excludeId?: string): Promise<Food | null> {
  await connectDatabase();
  const filter: Record<string, unknown> = {
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
  };

  if (excludeId) {
    filter.id = { $ne: excludeId };
  }

  const food = await FoodModel.findOne(filter).lean<FoodRecord | null>().exec();
  return food ? toFood(food) : null;
}

export async function insertFood(food: Food): Promise<Food> {
  await connectDatabase();
  const created = await FoodModel.create({
    id: food.id,
    name: food.name,
    unitQuantity: food.unitQuantity,
    unitType: food.unitType,
    caloriesPerUnit: food.caloriesPerUnit,
    proteinPerUnit: food.proteinPerUnit,
    fiberPerUnit: food.fiberPerUnit,
    createdAt: new Date(food.createdAt),
    updatedAt: new Date(food.updatedAt),
  });
  return toFood(created.toObject() as FoodRecord);
}

export async function updateFood(
  id: string,
  updates: Pick<Food, "name" | "unitQuantity" | "unitType" | "caloriesPerUnit" | "proteinPerUnit" | "fiberPerUnit" | "updatedAt">,
): Promise<Food | null> {
  await connectDatabase();
  const updated = await FoodModel.findOneAndUpdate(
    { id },
    {
      $set: {
        name: updates.name,
        unitQuantity: updates.unitQuantity,
        unitType: updates.unitType,
        caloriesPerUnit: updates.caloriesPerUnit,
        proteinPerUnit: updates.proteinPerUnit,
        fiberPerUnit: updates.fiberPerUnit,
        updatedAt: new Date(updates.updatedAt),
      },
    },
    { new: true, runValidators: true },
  )
    .lean<FoodRecord | null>()
    .exec();

  return updated ? toFood(updated) : null;
}

export async function countFoodReferences(foodId: string): Promise<{ templateReferences: number; logReferences: number }> {
  await connectDatabase();
  const [templateReferences, logReferences] = await Promise.all([
    TemplateItemModel.countDocuments({ foodId }).exec(),
    LogEntryModel.countDocuments({ foodId }).exec(),
  ]);

  return { templateReferences, logReferences };
}

export async function removeFood(id: string): Promise<boolean> {
  await connectDatabase();
  const result = await FoodModel.deleteOne({ id }).exec();
  return result.deletedCount > 0;
}

async function listTemplateItemsByTemplateIds(templateIds: string[]): Promise<TemplateItem[]> {
  if (templateIds.length === 0) {
    return [];
  }

  const items = await TemplateItemModel.find({ templateId: { $in: templateIds } })
    .sort({ templateId: 1, lineNumber: 1, id: 1 })
    .lean<TemplateItemRecord[]>()
    .exec();

  return items.map(toTemplateItem);
}

export async function listTemplatesForUser(userId: string): Promise<TemplateWithItems[]> {
  await connectDatabase();
  const templates = await TemplateModel.find({ userId }).sort({ createdAt: 1, id: 1 }).lean<TemplateRecord[]>().exec();
  const normalizedTemplates = templates.map(toTemplate);
  const items = await listTemplateItemsByTemplateIds(normalizedTemplates.map((template) => template.id));
  const itemsByTemplateId = new Map<string, TemplateItem[]>();

  items.forEach((item) => {
    const existing = itemsByTemplateId.get(item.templateId) ?? [];
    existing.push(item);
    itemsByTemplateId.set(item.templateId, existing);
  });

  return normalizedTemplates.map((template) => buildTemplateWithItems(template, itemsByTemplateId.get(template.id) ?? []));
}

export async function findTemplateById(id: string): Promise<TemplateWithItems | null> {
  await connectDatabase();
  const template = await TemplateModel.findOne({ id }).lean<TemplateRecord | null>().exec();

  if (!template) {
    return null;
  }

  const normalizedTemplate = toTemplate(template);
  const items = await listTemplateItemsByTemplateIds([id]);
  return buildTemplateWithItems(normalizedTemplate, items);
}

export async function insertTemplateWithItems(template: Template, items: TemplateItem[]): Promise<TemplateWithItems> {
  await connectDatabase();

  await TemplateModel.create({
    id: template.id,
    userId: template.userId,
    name: template.name,
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
  });

  if (items.length > 0) {
    await TemplateItemModel.insertMany(
      items.map((item) => ({
        id: item.id,
        templateId: item.templateId,
        lineNumber: item.lineNumber,
        foodId: item.foodId,
        defaultAmount: item.defaultAmount,
      })),
    );
  }

  return buildTemplateWithItems(template, items);
}

export async function updateTemplateWithItems(template: Template, items: TemplateItem[]): Promise<TemplateWithItems | null> {
  await connectDatabase();

  const updatedTemplate = await TemplateModel.findOneAndUpdate(
    { id: template.id },
    {
      $set: {
        name: template.name,
        updatedAt: new Date(template.updatedAt),
      },
    },
    { new: true, runValidators: true },
  )
    .lean<TemplateRecord | null>()
    .exec();

  if (!updatedTemplate) {
    return null;
  }

  await TemplateItemModel.deleteMany({ templateId: template.id }).exec();

  if (items.length > 0) {
    await TemplateItemModel.insertMany(
      items.map((item) => ({
        id: item.id,
        templateId: item.templateId,
        lineNumber: item.lineNumber,
        foodId: item.foodId,
        defaultAmount: item.defaultAmount,
      })),
    );
  }

  return buildTemplateWithItems(toTemplate(updatedTemplate), items);
}

export async function removeTemplate(id: string): Promise<boolean> {
  await connectDatabase();
  const result = await TemplateModel.deleteOne({ id }).exec();
  if (result.deletedCount === 0) {
    return false;
  }

  await TemplateItemModel.deleteMany({ templateId: id }).exec();
  return true;
}

export async function listLogEntriesForUser(userId: string, filters?: LogEntryFilters): Promise<LogEntry[]> {
  await connectDatabase();
  const query: Record<string, unknown> = { userId };

  if (filters?.date) {
    query.date = filters.date;
  } else {
    const range: Record<string, string> = {};
    if (filters?.startDate) {
      range.$gte = filters.startDate;
    }
    if (filters?.endDate) {
      range.$lte = filters.endDate;
    }
    if (Object.keys(range).length > 0) {
      query.date = range;
    }
  }

  const entries = await LogEntryModel.find(query)
    .sort({ date: 1, createdAt: 1, id: 1 })
    .lean<LogEntryRecord[]>()
    .exec();

  return normalizeLogEntryRecords(entries);
}

export async function findLogEntryById(id: string): Promise<LogEntry | null> {
  await connectDatabase();
  const entry = await LogEntryModel.findOne({ id }).lean<LogEntryRecord | null>().exec();
  if (!entry) {
    return null;
  }

  const [normalized] = await normalizeLogEntryRecords([entry]);
  return normalized ?? null;
}

export async function insertLogEntry(entry: LogEntry): Promise<LogEntry> {
  await connectDatabase();
  const created = await LogEntryModel.create({
    id: entry.id,
    userId: entry.userId,
    date: entry.date,
    meal: entry.meal,
    templateId: entry.templateId,
    templateNameSnapshot: entry.templateNameSnapshot,
    foodId: entry.foodId,
    actualAmount: entry.actualAmount,
    nutritionSnapshot: entry.nutritionSnapshot,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  });

  return toLogEntry(created.toObject() as LogEntryRecord);
}

export async function insertLogEntries(entries: LogEntry[]): Promise<LogEntry[]> {
  await connectDatabase();

  if (entries.length === 0) {
    return [];
  }

  const created = await LogEntryModel.insertMany(
    entries.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      date: entry.date,
      meal: entry.meal,
      templateId: entry.templateId,
      templateNameSnapshot: entry.templateNameSnapshot,
      foodId: entry.foodId,
      actualAmount: entry.actualAmount,
      nutritionSnapshot: entry.nutritionSnapshot,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    })),
  );

  return created.map((entry) => toLogEntry(entry.toObject() as LogEntryRecord));
}

export async function updateLogEntry(
  id: string,
  updates: Pick<LogEntry, "date" | "meal" | "foodId" | "actualAmount" | "nutritionSnapshot" | "updatedAt">,
): Promise<LogEntry | null> {
  await connectDatabase();
  const updated = await LogEntryModel.findOneAndUpdate(
    { id },
    {
      $set: {
        date: updates.date,
        meal: updates.meal,
        foodId: updates.foodId,
        actualAmount: updates.actualAmount,
        nutritionSnapshot: updates.nutritionSnapshot,
        updatedAt: new Date(updates.updatedAt),
      },
    },
    { new: true, runValidators: true },
  )
    .lean<LogEntryRecord | null>()
    .exec();

  return updated ? toLogEntry(updated) : null;
}

export async function removeLogEntry(id: string): Promise<boolean> {
  await connectDatabase();
  const result = await LogEntryModel.deleteOne({ id }).exec();
  return result.deletedCount > 0;
}

export async function readDatabase(): Promise<Database> {
  const [users, foods, templates, logEntries] = await Promise.all([
    listUsers(),
    listFoods(),
    listTemplatesForUserless(),
    listAllLogEntries(),
  ]);

  return {
    users,
    foods,
    templates: templates.templates,
    templateItems: templates.templateItems,
    logEntries,
  };
}

async function listTemplatesForUserless(): Promise<{ templates: Template[]; templateItems: TemplateItem[] }> {
  await connectDatabase();
  const [templates, templateItems] = await Promise.all([
    TemplateModel.find().sort({ createdAt: 1, id: 1 }).lean<TemplateRecord[]>().exec(),
    TemplateItemModel.find().sort({ templateId: 1, lineNumber: 1, id: 1 }).lean<TemplateItemRecord[]>().exec(),
  ]);

  return {
    templates: templates.map(toTemplate),
    templateItems: templateItems.map(toTemplateItem),
  };
}

async function listAllLogEntries(): Promise<LogEntry[]> {
  await connectDatabase();
  const entries = await LogEntryModel.find().sort({ date: 1, createdAt: 1, id: 1 }).lean<LogEntryRecord[]>().exec();
  return normalizeLogEntryRecords(entries);
}

async function replaceCollection<T extends { deleteMany: () => Promise<unknown>; insertMany: (docs: unknown[]) => Promise<unknown> }>(
  model: T,
  docs: unknown[],
) {
  await model.deleteMany();
  if (docs.length > 0) {
    await model.insertMany(docs);
  }
}

export async function writeDatabase(database: Database): Promise<void> {
  writeChain = writeChain.then(async () => {
    await connectDatabase();

    await replaceCollection(UserModel, database.users.map((user) => ({ id: user.id, name: user.name })));
    await replaceCollection(
      FoodModel,
      database.foods.map((food) => ({
        id: food.id,
        name: food.name,
        unitQuantity: food.unitQuantity,
        unitType: food.unitType,
        caloriesPerUnit: food.caloriesPerUnit,
        proteinPerUnit: food.proteinPerUnit,
        fiberPerUnit: food.fiberPerUnit,
        createdAt: new Date(food.createdAt),
        updatedAt: new Date(food.updatedAt),
      })),
    );
    await replaceCollection(
      TemplateModel,
      database.templates.map((template) => ({
        id: template.id,
        userId: template.userId,
        name: template.name,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
      })),
    );
    await replaceCollection(
      TemplateItemModel,
      database.templateItems.map((item) => ({
        id: item.id,
        templateId: item.templateId,
        lineNumber: item.lineNumber,
        foodId: item.foodId,
        defaultAmount: item.defaultAmount,
      })),
    );
    await replaceCollection(
      LogEntryModel,
      database.logEntries.map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        date: entry.date,
        meal: entry.meal,
        templateId: entry.templateId,
        templateNameSnapshot: entry.templateNameSnapshot,
        foodId: entry.foodId,
        actualAmount: entry.actualAmount,
        nutritionSnapshot: entry.nutritionSnapshot,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      })),
    );
  });

  await writeChain;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
