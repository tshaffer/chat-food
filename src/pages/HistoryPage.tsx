import { useEffect, useMemo, useState } from "react";
import { meals, type AddFromTemplateInput, type Food, type LogEntry, type LogEntryInput, type Meal, type TemplateWithItems, type User } from "@shared/types";
import { AddFromTemplateDialog } from "../components/AddFromTemplateDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LogEntryFormDialog } from "../components/LogEntryFormDialog";
import { MealSection } from "../components/MealSection";
import { NutritionSummaryCard } from "../components/NutritionSummaryCard";
import { api } from "../lib/api";
import { formatDisplayDate, getTodayDateString } from "../lib/date";
import { buildDailySummaries, enrichLogEntries, getMealTotals, groupEntriesByMeal, type EnrichedLogEntry } from "../lib/logEntries";
import { formatNumber } from "../lib/format";

interface HistoryPageProps {
  currentUser: User | null;
}

function getDefaultStartDate(): string {
  const now = new Date();
  now.setDate(now.getDate() - 13);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function HistoryPage({ currentUser }: HistoryPageProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getTodayDateString());
  const [selectedDate, setSelectedDate] = useState("");
  const [createMeal, setCreateMeal] = useState<Meal>("Breakfast");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EnrichedLogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedLogEntry | null>(null);

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

  async function loadHistory() {
    if (!currentUser) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [nextEntries, nextTemplates] = await Promise.all([
        api.getLogEntries(currentUser.id, { startDate, endDate }),
        api.getTemplates(currentUser.id),
      ]);
      setEntries(nextEntries);
      setTemplates(nextTemplates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load history.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, [currentUser, startDate, endDate]);

  const enrichedEntries = useMemo(() => enrichLogEntries(entries, foods), [entries, foods]);
  const dailySummaries = useMemo(() => buildDailySummaries(enrichedEntries), [enrichedEntries]);

  useEffect(() => {
    if (!dailySummaries.length) {
      setSelectedDate("");
      return;
    }

    setSelectedDate((current) => {
      if (current && dailySummaries.some((summary) => summary.date === current)) {
        return current;
      }

      return dailySummaries[0].date;
    });
  }, [dailySummaries]);

  const selectedSummary = dailySummaries.find((summary) => summary.date === selectedDate) ?? null;
  const groupedEntries = useMemo(
    () => (selectedSummary ? groupEntriesByMeal(selectedSummary.entries) : null),
    [selectedSummary],
  );

  async function refreshHistory() {
    await loadHistory();
  }

  async function handleCreateEntry(input: LogEntryInput) {
    if (!currentUser) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await api.createLogEntry(currentUser.id, input);
      await refreshHistory();
      setSelectedDate(input.date);
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
      await refreshHistory();
      setSelectedDate(input.date);
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
      await refreshHistory();
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
      await refreshHistory();
      setSelectedDate(input.date);
      setIsTemplateOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to add entries from template.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!currentUser) {
    return <div className="empty-state">Select a user to view history.</div>;
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily totals</p>
          <h1>History</h1>
        </div>
        <div className="page-header__actions">
          <label className="date-control">
            <span>Start Date</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="date-control">
            <span>End Date</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </header>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="history-layout">
        <aside className="card history-sidebar">
          {isLoading ? (
            <div className="empty-state compact">
              <h2>Loading history</h2>
              <p>Fetching saved daily totals for {currentUser.name}.</p>
            </div>
          ) : dailySummaries.length === 0 ? (
            <div className="empty-state compact">
              <h2>No history in this range</h2>
              <p>Try a wider date range or add an entry for one of these days.</p>
            </div>
          ) : (
            dailySummaries.map((summary) => (
              <button
                key={summary.date}
                className={summary.date === selectedDate ? "history-day history-day--active" : "history-day"}
                type="button"
                onClick={() => setSelectedDate(summary.date)}
              >
                <strong>{summary.date}</strong>
                <span>
                  {formatNumber(summary.totals.calories)} cal • {formatNumber(summary.totals.protein)} protein •{" "}
                  {formatNumber(summary.totals.fiber)} fiber
                </span>
              </button>
            ))
          )}
        </aside>

        <div className="stack">
          {!selectedSummary ? (
            <div className="card empty-state">
              <h2>No day selected</h2>
              <p>Select a day from the left to inspect the details.</p>
            </div>
          ) : (
            <>
              <div className="card history-detail">
                <div className="page-header">
                  <div>
                    <p className="eyebrow">Selected Day</p>
                    <h2>{formatDisplayDate(selectedSummary.date)}</h2>
                  </div>
                  <div className="page-header__actions">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => {
                        setCreateMeal("Breakfast");
                        setIsCreateOpen(true);
                      }}
                    >
                      Add Food
                    </button>
                    <button className="button button--secondary" type="button" onClick={() => setIsTemplateOpen(true)}>
                      Add from Template
                    </button>
                  </div>
                </div>

                <section className="summary-grid">
                  <NutritionSummaryCard label="Calories" value={selectedSummary.totals.calories} />
                  <NutritionSummaryCard label="Protein" value={selectedSummary.totals.protein} />
                  <NutritionSummaryCard label="Fiber" value={selectedSummary.totals.fiber} />
                </section>
              </div>

              {groupedEntries
                ? meals.map((meal) => (
                    <MealSection
                      key={meal}
                      meal={meal}
                      entries={groupedEntries[meal]}
                      totals={getMealTotals(groupedEntries[meal])}
                      onAdd={(nextMeal) => {
                        setCreateMeal(nextMeal);
                        setIsCreateOpen(true);
                      }}
                      onEdit={setEditingEntry}
                      onDelete={setDeleteTarget}
                    />
                  ))
                : null}
            </>
          )}
        </div>
      </div>

      {isCreateOpen && selectedSummary ? (
        <LogEntryFormDialog
          currentUser={currentUser}
          foods={foods}
          initialValues={{ date: selectedSummary.date, meal: createMeal, foodId: "", actualAmount: 0 }}
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

      {isTemplateOpen && selectedSummary ? (
        <AddFromTemplateDialog
          currentUser={currentUser}
          foods={foods}
          templates={templates}
          initialValues={{ date: selectedSummary.date, meal: "Breakfast", templateId: templates[0]?.id ?? "", multiplier: 1 }}
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
          description={`Delete the ${deleteTarget.meal.toLowerCase()} entry for ${deleteTarget.food?.name ?? "this food"} on ${deleteTarget.date}?`}
          isPending={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteEntry}
        />
      ) : null}
    </section>
  );
}
