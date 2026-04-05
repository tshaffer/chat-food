import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database } from "../shared/types.js";

const databasePath = path.resolve(process.cwd(), "data", "db.json");

let writeChain: Promise<void> = Promise.resolve();

export async function readDatabase(): Promise<Database> {
  const file = await fs.readFile(databasePath, "utf-8");
  return JSON.parse(file) as Database;
}

export async function writeDatabase(database: Database): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    await fs.writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`, "utf-8");
  });

  await writeChain;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
