import { disconnectDatabase, writeDatabase } from "./store.js";

async function main() {
  await writeDatabase({
    users: [],
    foods: [],
    templates: [],
    templateItems: [],
    logEntries: [],
  });

  console.log("Cleared Food Tracker collections from MongoDB.");
  await disconnectDatabase();
}

void main().catch((error) => {
  console.error("Failed to clear MongoDB data", error);
  process.exitCode = 1;
});
