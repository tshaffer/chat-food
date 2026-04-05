import { useEffect, useMemo, useState } from "react";
import { meals, type AddFromTemplateInput, type Food, type LogEntry, type LogEntryInput, type Meal, type TemplateWithItems, type User } from "@shared/types";
import { AddFromTemplateDialog } from "../components/AddFromTemplateDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LogEntryFormDialog } from "../components/LogEntryFormDialog";
import { api } from "../lib/api";
import { enrichLogEntries, type EnrichedLogEntry } from "../lib/logEntries";
import { formatNumber } from "../lib/format";
import { getTodayDateString } from "../lib/date";

interface LogPageProps {
  currentUser: User | null;
}

export function LogPage({ currentUser }: LogPageProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EnrichedLogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedLogEntry | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [mealFilter, setMealFilter] = useState<Meal | "">("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFoods() {
      try {
        const nextFoods = await api.getFoods();
        if (!cancelled) {
          setFoods(nextFoods);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load foods.");
        }
      }
    }

    void loadFoods();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const userId = currentUser.id;
    let cancelled = false;
    setIsLoading(true);
    setError("");

    async function loadData() {
      try {
        const [nextEntries, nextTemplates] = await Promise.all([
          api.getLogEntries(userId),
          api.getTemplates(userId),
        ]);

        if (!cancelled) {
          setEntries(nextEntries);
          setTemplates(nextTemplates);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load log data.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const enrichedEntries = useMemo(() => enrichLogEntries(entries, foods), [entries, foods]);
  const filteredEntries = useMemo(() => {
    return enrichedEntries.filter((entry) => {
      if (dateFilter && entry.date !== dateFilter) {
        return false;
      }

      if (mealFilter && entry.meal !== mealFilter) {
        return false;
      }

      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const foodName = entry.food?.name.toLowerCase() ?? "";
        const templateName = entry.templateNameSnapshot?.toLowerCase() ?? "";

        if (!foodName.includes(query) && !templateName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilter, enrichedEntries, mealFilter, searchText]);

  const createMeal: Meal = mealFilter || "Breakfast";

  async function refreshData() {
    if (!currentUser) {
      return;
    }

    const [nextEntries, nextTemplates] = await Promise.all([
      api.getLogEntries(currentUser.id),
      api.getTemplates(currentUser.id),
    ]);
    setEntries(nextEntries);
    setTemplates(nextTemplates);
  }

  async function handleCreateEntry(input: LogEntryInput) {
    if (!currentUser) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await api.createLogEntry(currentUser.id, input);
      await refreshData();
      setIsCreateOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save log entry.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateEntry(input: LogEntryInput) {
    if (!editingEntry) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await api.updateLogEntry(editingEntry.id, input);
      await refreshData();
      setEditingEntry(null);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to update log entry.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEntry() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await api.deleteLogEntry(deleteTarget.id);
      await refreshData();
      setDeleteTarget(null);
      setEditingEntry(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete log entry.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddFromTemplate(input: AddFromTemplateInput) {
    if (!currentUser) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await api.addEntriesFromTemplate(currentUser.id, input);
      await refreshData();
      setIsTemplateOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to add entries from template.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!currentUser) {
    return <div className="empty-state">Select a user to view the log.</div>;
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Entry history</p>
          <h1>Log</h1>
        </div>

        <div className="page-header__actions">
          <button className="button button--primary" type="button" onClick={() => setIsCreateOpen(true)}>
            Add Food Entry
          </button>
          <button className="button button--secondary" type="button" onClick={() => setIsTemplateOpen(true)}>
            Add from Template
          </button>
        </div>
      </header>

      <div className="card filters-bar">
        <label className="date-control">
          <span>Date</span>
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </label>
        <label className="date-control">
          <span>Meal</span>
          <select value={mealFilter} onChange={(event) => setMealFilter(event.target.value as Meal | "")}>
            <option value="">All meals</option>
            {meals.map((meal) => (
              <option key={meal} value={meal}>
                {meal}
              </option>
            ))}
          </select>
        </label>
        <label className="date-control filters-bar__search">
          <span>Search</span>
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Food or template" />
        </label>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            setDateFilter("");
            setMealFilter("");
            setSearchText("");
          }}
        >
          Clear Filters
        </button>
      </div>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="card">
        {isLoading ? (
          <div className="empty-state compact">
            <p>Loading log entries...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state compact">
            <p>No log entries match the current filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Template</th>
                  <th>Food</th>
                  <th>Amount</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Fiber</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.meal}</td>
                    <td>{entry.templateNameSnapshot ?? ""}</td>
                    <td>{entry.food?.name ?? "Unknown food"}</td>
                    <td>
                      {formatNumber(entry.actualAmount)} {entry.food?.unitType ?? ""}
                    </td>
                    <td>{formatNumber(entry.nutrition.calories)}</td>
                    <td>{formatNumber(entry.nutrition.protein)}</td>
                    <td>{formatNumber(entry.nutrition.fiber)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="button button--ghost" type="button" onClick={() => setEditingEntry(entry)}>
                          Edit
                        </button>
                        <button className="button button--ghost-danger" type="button" onClick={() => setDeleteTarget(entry)}>
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
      </div>

      {isCreateOpen ? (
        <LogEntryFormDialog
          currentUser={currentUser}
          foods={foods}
          initialValues={{ date: dateFilter || getTodayDateString(), meal: createMeal, foodId: "", actualAmount: 0 }}
          entry={null}
          isSaving={isSaving}
          error={formError}
          onCancel={() => {
            setIsCreateOpen(false);
            setFormError("");
          }}
          onSubmit={handleCreateEntry}
        />
      ) : null}

      {editingEntry ? (
        <LogEntryFormDialog
          currentUser={currentUser}
          foods={foods}
          initialValues={{
            date: editingEntry.date,
            meal: editingEntry.meal,
            foodId: editingEntry.foodId,
            actualAmount: editingEntry.actualAmount,
          }}
          entry={editingEntry}
          isSaving={isSaving}
          error={formError}
          onCancel={() => {
            setEditingEntry(null);
            setFormError("");
          }}
          onSubmit={handleUpdateEntry}
          onDelete={() => setDeleteTarget(editingEntry)}
        />
      ) : null}

      {isTemplateOpen ? (
        <AddFromTemplateDialog
          currentUser={currentUser}
          foods={foods}
          templates={templates}
          initialValues={{
            date: dateFilter || getTodayDateString(),
            meal: createMeal,
            templateId: templates[0]?.id ?? "",
            multiplier: 1,
          }}
          isSaving={isSaving}
          error={formError}
          onCancel={() => {
            setIsTemplateOpen(false);
            setFormError("");
          }}
          onSubmit={handleAddFromTemplate}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete Log Entry"
          description={`Delete ${deleteTarget.food?.name ?? "this entry"} from ${deleteTarget.date}?`}
          isPending={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteEntry}
        />
      ) : null}
    </section>
  );
}
