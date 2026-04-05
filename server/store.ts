import mongoose from "mongoose";
import type { Database, Food, LogEntry, Template, TemplateItem, User } from "../shared/types.js";
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

function asIsoString(value: Date | string | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUser(record: { id: string; name: string }): User {
  return { id: record.id, name: record.name };
}

function toFood(record: {
  id: string;
  name: string;
  unitQuantity: number;
  unitType: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  fiberPerUnit: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): Food {
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

function toTemplate(record: {
  id: string;
  userId: string;
  name: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): Template {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
  };
}

function toTemplateItem(record: {
  id: string;
  templateId: string;
  lineNumber: number;
  foodId: string;
  defaultAmount: number;
}): TemplateItem {
  return {
    id: record.id,
    templateId: record.templateId,
    lineNumber: record.lineNumber,
    foodId: record.foodId,
    defaultAmount: record.defaultAmount,
  };
}

function toLogEntry(record: {
  id: string;
  userId: string;
  date: string;
  meal: LogEntry["meal"];
  templateId: string | null;
  templateNameSnapshot: string | null;
  foodId: string;
  actualAmount: number;
  nutritionSnapshot: LogEntry["nutritionSnapshot"];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): LogEntry {
  return {
    id: record.id,
    userId: record.userId,
    date: record.date,
    meal: record.meal,
    templateId: record.templateId,
    templateNameSnapshot: record.templateNameSnapshot,
    foodId: record.foodId,
    actualAmount: record.actualAmount,
    nutritionSnapshot: record.nutritionSnapshot,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
  };
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

export async function readDatabase(): Promise<Database> {
  await connectDatabase();

  const [users, foods, templates, templateItems, logEntries] = await Promise.all([
    UserModel.find().sort({ name: 1, id: 1 }).lean(),
    FoodModel.find().sort({ name: 1, id: 1 }).lean(),
    TemplateModel.find().sort({ createdAt: 1, id: 1 }).lean(),
    TemplateItemModel.find().sort({ templateId: 1, lineNumber: 1, id: 1 }).lean(),
    LogEntryModel.find().sort({ date: 1, createdAt: 1, id: 1 }).lean(),
  ]);

  return {
    users: users.map(toUser),
    foods: foods.map(toFood),
    templates: templates.map(toTemplate),
    templateItems: templateItems.map(toTemplateItem),
    logEntries: logEntries.map(toLogEntry),
  };
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

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
