import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database } from "../shared/types.js";

let writeChain: Promise<void> = Promise.resolve();

function getDatabasePath(): string {
  return process.env.FOOD_TRACKER_DB_PATH
    ? path.resolve(process.env.FOOD_TRACKER_DB_PATH)
    : path.resolve(process.cwd(), "data", "db.json");
}

export async function readDatabase(): Promise<Database> {
  const file = await fs.readFile(getDatabasePath(), "utf-8");
  return JSON.parse(file) as Database;
}

export async function writeDatabase(database: Database): Promise<void> {
  const databasePath = getDatabasePath();
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    await fs.writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`, "utf-8");
  });

  await writeChain;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
