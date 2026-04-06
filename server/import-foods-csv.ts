import { promises as fs } from "node:fs";
import path from "node:path";
import type { Food } from "../shared/types.js";
import {
  createId,
  disconnectDatabase,
  findFoodByNameInsensitive,
  insertFood,
  updateFood,
} from "./store.js";

interface CsvFoodRow {
  name: string;
  unitQuantity: number;
  unitType: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  fiberPerUnit: number;
}

const REQUIRED_COLUMNS = {
  name: "Name",
  unitQuantity: "Unit Quantity",
  unitType: "Unit Type",
  caloriesPerUnit: "Calories per unit",
  proteinPerUnit: "Protein per unit",
  fiberPerUnit: "Fiber per unit",
} as const;

async function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "data", "foods.csv");

  const raw = await fs.readFile(inputPath, "utf-8");
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    throw new Error(`No rows found in ${inputPath}`);
  }

  const headers = rows[0];
  validateHeaders(headers);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const skipMessages: string[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const parsed = parseFoodRow(headers, row);

    if (!parsed.ok) {
      skipped += 1;
      skipMessages.push(`Row ${rowIndex + 1}: ${parsed.reason}`);
      continue;
    }

    const existing = await findFoodByNameInsensitive(parsed.value.name);

    if (existing) {
      await updateFood(existing.id, {
        name: parsed.value.name,
        unitQuantity: parsed.value.unitQuantity,
        unitType: parsed.value.unitType,
        caloriesPerUnit: parsed.value.caloriesPerUnit,
        proteinPerUnit: parsed.value.proteinPerUnit,
        fiberPerUnit: parsed.value.fiberPerUnit,
        updatedAt: new Date().toISOString(),
      });
      updated += 1;
      continue;
    }

    const now = new Date().toISOString();
    const food: Food = {
      id: createId("food"),
      name: parsed.value.name,
      unitQuantity: parsed.value.unitQuantity,
      unitType: parsed.value.unitType,
      caloriesPerUnit: parsed.value.caloriesPerUnit,
      proteinPerUnit: parsed.value.proteinPerUnit,
      fiberPerUnit: parsed.value.fiberPerUnit,
      createdAt: now,
      updatedAt: now,
    };

    await insertFood(food);
    inserted += 1;
  }

  console.log(`Imported foods from ${inputPath}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  if (skipMessages.length > 0) {
    console.log("");
    console.log("Skipped rows:");
    skipMessages.forEach((message) => console.log(`- ${message}`));
  }

  await disconnectDatabase();
}

function validateHeaders(headers: string[]) {
  const missing = Object.values(REQUIRED_COLUMNS).filter((name) => !headers.includes(name));

  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(", ")}`);
  }
}

function parseFoodRow(
  headers: string[],
  row: string[],
): { ok: true; value: CsvFoodRow } | { ok: false; reason: string } {
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));

  const name = record[REQUIRED_COLUMNS.name] ?? "";
  const unitType = record[REQUIRED_COLUMNS.unitType] ?? "";
  const unitQuantity = parseNumber(record[REQUIRED_COLUMNS.unitQuantity]);
  const caloriesPerUnit = parseNumber(record[REQUIRED_COLUMNS.caloriesPerUnit]);
  const proteinPerUnit = parseNumber(record[REQUIRED_COLUMNS.proteinPerUnit]);
  const fiberPerUnit = parseNumber(record[REQUIRED_COLUMNS.fiberPerUnit]);

  const isCompletelyBlank = [name, unitType, record[REQUIRED_COLUMNS.unitQuantity], record[REQUIRED_COLUMNS.caloriesPerUnit]]
    .map((value) => String(value ?? "").trim())
    .every((value) => value.length === 0);

  if (isCompletelyBlank) {
    return { ok: false, reason: "blank separator row" };
  }

  if (!name) {
    return { ok: false, reason: "missing Name" };
  }

  if (!unitType) {
    return { ok: false, reason: `missing Unit Type for "${name}"` };
  }

  if (unitQuantity === null || unitQuantity <= 0) {
    return { ok: false, reason: `invalid Unit Quantity for "${name}"` };
  }

  if (caloriesPerUnit === null || caloriesPerUnit < 0) {
    return { ok: false, reason: `invalid Calories per unit for "${name}"` };
  }

  if (proteinPerUnit === null || proteinPerUnit < 0) {
    return { ok: false, reason: `invalid Protein per unit for "${name}"` };
  }

  if (fiberPerUnit === null || fiberPerUnit < 0) {
    return { ok: false, reason: `invalid Fiber per unit for "${name}"` };
  }

  return {
    ok: true,
    value: {
      name,
      unitQuantity,
      unitType,
      caloriesPerUnit,
      proteinPerUnit,
      fiberPerUnit,
    },
  };
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

void main().catch((error) => {
  console.error("Failed to import foods CSV", error);
  process.exitCode = 1;
});
