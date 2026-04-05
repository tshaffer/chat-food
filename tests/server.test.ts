import test from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../shared/types.js";
import { createTempDatabase, readTempDatabase, withTestServer } from "./helpers.js";

function makeDatabase(): Database {
  return {
    users: [
      { id: "user_1", name: "Ted" },
      { id: "user_2", name: "Alex" },
    ],
    foods: [
      {
        id: "food_1",
        name: "Greek Yogurt",
        unitQuantity: 170,
        unitType: "g",
        caloriesPerUnit: 100,
        proteinPerUnit: 17,
        fiberPerUnit: 0,
        createdAt: "2026-04-05T20:00:00.000Z",
        updatedAt: "2026-04-05T20:00:00.000Z",
      },
      {
        id: "food_2",
        name: "Blueberries",
        unitQuantity: 100,
        unitType: "g",
        caloriesPerUnit: 57,
        proteinPerUnit: 0.7,
        fiberPerUnit: 2.4,
        createdAt: "2026-04-05T20:00:00.000Z",
        updatedAt: "2026-04-05T20:00:00.000Z",
      },
    ],
    templates: [
      {
        id: "template_1",
        userId: "user_1",
        name: "Breakfast Bowl",
        createdAt: "2026-04-05T20:00:00.000Z",
        updatedAt: "2026-04-05T20:00:00.000Z",
      },
    ],
    templateItems: [
      {
        id: "template_item_1",
        templateId: "template_1",
        lineNumber: 1,
        foodId: "food_1",
        defaultAmount: 170,
      },
      {
        id: "template_item_2",
        templateId: "template_1",
        lineNumber: 2,
        foodId: "food_2",
        defaultAmount: 100,
      },
    ],
    logEntries: [
      {
        id: "entry_1",
        userId: "user_1",
        date: "2026-04-05",
        meal: "Breakfast",
        templateId: null,
        templateNameSnapshot: null,
        foodId: "food_1",
        actualAmount: 170,
        nutritionSnapshot: { calories: 100, protein: 17, fiber: 0 },
        createdAt: "2026-04-05T20:00:00.000Z",
        updatedAt: "2026-04-05T20:00:00.000Z",
      },
    ],
  };
}

test("POST /api/users/:userId/log-entries/from-template creates snapshotted entries", async () => {
  const { cleanup } = await createTempDatabase(makeDatabase());

  try {
    await withTestServer(async (request) => {
      const response = await request({
        method: "POST",
        url: "/api/users/user_1/log-entries/from-template",
        body: {
          date: "2026-04-06",
          meal: "Lunch",
          templateId: "template_1",
          multiplier: 1.5,
        },
      });

      assert.equal(response.status, 201);
      const body = response.json as Database["logEntries"];
      assert.equal(body.length, 2);
      assert.deepEqual(body[0].nutritionSnapshot, { calories: 150, protein: 25.5, fiber: 0 });
      assert.deepEqual(body[1].nutritionSnapshot, { calories: 85.5, protein: 1.1, fiber: 3.6 });
    });

    const database = await readTempDatabase();
    const created = database.logEntries.filter((entry) => entry.date === "2026-04-06");
    assert.equal(created.length, 2);
    assert.equal(created[0].templateNameSnapshot, "Breakfast Bowl");
  } finally {
    await cleanup();
  }
});

test("DELETE /api/foods/:id blocks deletion when the food is still referenced", async () => {
  const { cleanup } = await createTempDatabase(makeDatabase());

  try {
    await withTestServer(async (request) => {
      const response = await request({
        method: "DELETE",
        url: "/api/foods/food_1",
      });

      assert.equal(response.status, 409);
      const body = response.json as { error: { message: string } };
      assert.match(body.error.message, /template item/);
      assert.match(body.error.message, /log entry/);
    });
  } finally {
    await cleanup();
  }
});

test("template save and update return normalized ordered items", async () => {
  const { cleanup } = await createTempDatabase(makeDatabase());

  try {
    await withTestServer(async (request) => {
      const createResponse = await request({
        method: "POST",
        url: "/api/users/user_1/templates",
        body: {
          name: "Evening Snack",
          items: [
            { lineNumber: 4, foodId: "food_2", defaultAmount: 200 },
            { lineNumber: 2, foodId: "food_1", defaultAmount: 85 },
          ],
        },
      });

      assert.equal(createResponse.status, 201);
      const created = createResponse.json as { id: string; items: Array<{ lineNumber: number }> };
      assert.deepEqual(created.items.map((item) => item.lineNumber), [1, 2]);

      const updateResponse = await request({
        method: "PUT",
        url: `/api/templates/${created.id}`,
        body: {
          name: "Evening Snack Updated",
          items: [{ lineNumber: 9, foodId: "food_1", defaultAmount: 100 }],
        },
      });

      assert.equal(updateResponse.status, 200);
      const updated = updateResponse.json as {
        name: string;
        items: Array<{ lineNumber: number; defaultAmount: number; foodId: string }>;
      };
      assert.equal(updated.name, "Evening Snack Updated");
      assert.equal(updated.items.length, 1);
      assert.equal(updated.items[0].lineNumber, 1);
      assert.equal(updated.items[0].foodId, "food_1");
      assert.equal(updated.items[0].defaultAmount, 100);
    });

    const database = await readTempDatabase();
    const savedTemplate = database.templates.find((template) => template.name === "Evening Snack Updated");
    assert.ok(savedTemplate);
    const savedItems = database.templateItems.filter((item) => item.templateId === savedTemplate.id);
    assert.equal(savedItems.length, 1);
    assert.equal(savedItems[0].lineNumber, 1);
  } finally {
    await cleanup();
  }
});
