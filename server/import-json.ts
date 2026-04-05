import { promises as fs } from "node:fs";
import path from "node:path";
import { writeDatabase, disconnectDatabase } from "./store.js";
import type { Database } from "../shared/types.js";

async function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "data", "db.json");

  const raw = await fs.readFile(inputPath, "utf-8");
  const database = JSON.parse(raw) as Database;

  await writeDatabase(database);
  console.log(`Imported sample data from ${inputPath}`);
  await disconnectDatabase();
}

void main().catch((error) => {
  console.error("Failed to import JSON data", error);
  process.exitCode = 1;
});
