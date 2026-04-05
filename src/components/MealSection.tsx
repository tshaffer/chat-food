import type { Meal } from "@shared/types";
import { formatNumber } from "../lib/format";
import type { EnrichedLogEntry } from "../lib/logEntries";

interface MealSectionProps {
  meal: Meal;
  entries: EnrichedLogEntry[];
  totals: {
    calories: number;
    protein: number;
    fiber: number;
  };
  onAdd: (meal: Meal) => void;
  onEdit: (entry: EnrichedLogEntry) => void;
  onDelete: (entry: EnrichedLogEntry) => void;
}

export function MealSection({ meal, entries, totals, onAdd, onEdit, onDelete }: MealSectionProps) {
  return (
    <section className="card meal-section">
      <div className="meal-section__header">
        <div>
          <h2>{meal}</h2>
          <p className="meal-section__totals">
            {formatNumber(totals.calories)} cal • {formatNumber(totals.protein)} protein • {formatNumber(totals.fiber)} fiber
          </p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => onAdd(meal)}>
          + Add
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state compact meal-section__empty">
          <p>No entries for {meal.toLowerCase()} yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Food</th>
                <th>Amount</th>
                <th>Calories</th>
                <th>Protein</th>
                <th>Fiber</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.food?.name ?? "Unknown food"}</td>
                  <td>
                    {formatNumber(entry.actualAmount)} {entry.food?.unitType ?? ""}
                  </td>
                  <td>{formatNumber(entry.nutrition.calories)}</td>
                  <td>{formatNumber(entry.nutrition.protein)}</td>
                  <td>{formatNumber(entry.nutrition.fiber)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="button button--ghost" type="button" onClick={() => onEdit(entry)}>
                        Edit
                      </button>
                      <button className="button button--ghost-danger" type="button" onClick={() => onDelete(entry)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
