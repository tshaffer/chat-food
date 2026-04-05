import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { meals, type Food, type LogEntry, type LogEntryInput, type Meal, type User } from "@shared/types";
import { api } from "../lib/api";
import { formatDisplayDate, getTodayDateString } from "../lib/date";
import {
  enrichLogEntries,
  getMealTotals,
  groupEntriesByMeal,
  type EnrichedLogEntry,
} from "../lib/logEntries";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LogEntryFormDialog } from "../components/LogEntryFormDialog";
import { MealSection } from "../components/MealSection";
import { NutritionSummaryCard } from "../components/NutritionSummaryCard";

interface TodayPageProps {
  currentUser: User | null;
}

export function TodayPage({ currentUser }: TodayPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [foods, setFoods] = useState<Food[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingEntry, setEditingEntry] = useState<EnrichedLogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedLogEntry | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMeal, setCreateMeal] = useState<Meal>("Breakfast");
  const [createResetKey, setCreateResetKey] = useState("create-initial");

  useEffect(() => {
    const date = searchParams.get("date");
    if (date) {
      setSelectedDate(date);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("addEntry") === "1") {
      setCreateMeal((searchParams.get("meal") as Meal) || "Breakfast");
      setIsCreateOpen(true);
      setEditingEntry(null);
    }
  }, [searchParams]);

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

  async function loadEntries(userId: string, date: string) {
    setIsLoading(true);
    setError("");

    try {
      const nextEntries = await api.getLogEntries(userId, { date });
      setEntries(nextEntries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load log entries.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void loadEntries(currentUser.id, selectedDate);
  }, [currentUser, selectedDate]);

  const enrichedEntries = useMemo(() => enrichLogEntries(entries, foods), [entries, foods]);
  const groupedEntries = useMemo(() => groupEntriesByMeal(enrichedEntries), [enrichedEntries]);
  const dayTotals = useMemo(() => getMealTotals(enrichedEntries), [enrichedEntries]);

  function updateSearch(next: Record<string, string | null>) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      Object.entries(next).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return params;
    });
  }

  function openCreateDialog(meal: Meal = "Breakfast") {
    setCreateMeal(meal);
    setEditingEntry(null);
    setFormError("");
    setIsCreateOpen(true);
    updateSearch({ addEntry: "1", meal, date: selectedDate });
  }

  function closeCreateDialog() {
    setIsCreateOpen(false);
    setFormError("");
    updateSearch({ addEntry: null, meal: null });
  }

  function openEditDialog(entry: EnrichedLogEntry) {
    setEditingEntry(entry);
    setFormError("");
    setDeleteTarget(null);
    setIsCreateOpen(false);
    updateSearch({ addEntry: null, meal: null });
  }

  async function refreshEntries() {
    if (!currentUser) {
      return;
    }

    await loadEntries(currentUser.id, selectedDate);
  }

  async function handleCreateEntry(input: LogEntryInput, options?: { addAnother?: boolean }) {
    if (!currentUser) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await api.createLogEntry(currentUser.id, input);
      await refreshEntries();

      if (options?.addAnother) {
        setCreateMeal(input.meal);
        setCreateResetKey(`${input.date}-${input.meal}-${Date.now()}`);
      } else {
        closeCreateDialog();
      }
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
      setEditingEntry(null);
      await refreshEntries();
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
      setDeleteTarget(null);
      setEditingEntry(null);
      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete log entry.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (!currentUser) {
    return <div className="empty-state">Select a user to view today&apos;s log.</div>;
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily log</p>
          <h1>Today</h1>
          <p className="page-subtitle">{formatDisplayDate(selectedDate)}</p>
        </div>

        <div className="page-header__actions">
          <label className="date-control">
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setSelectedDate(nextDate);
                updateSearch({ date: nextDate });
              }}
            />
          </label>
          <button className="button button--primary" type="button" onClick={() => openCreateDialog()}>
            Add Food
          </button>
          <button className="button button--secondary" type="button" disabled title="Templates land in Phase 3">
            Add from Template
          </button>
        </div>
      </header>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <section className="summary-grid">
        <NutritionSummaryCard label="Calories" value={dayTotals.calories} />
        <NutritionSummaryCard label="Protein" value={dayTotals.protein} />
        <NutritionSummaryCard label="Fiber" value={dayTotals.fiber} />
      </section>

      {isLoading ? (
        <div className="empty-state">
          <p>Loading entries...</p>
        </div>
      ) : enrichedEntries.length === 0 ? (
        <div className="empty-state">
          <h2>No food logged for this day yet</h2>
          <p>Start with a single food entry for {currentUser.name}.</p>
          <div>
            <button className="button button--primary" type="button" onClick={() => openCreateDialog()}>
              Add Food
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading
        ? meals.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={groupedEntries[meal]}
              totals={getMealTotals(groupedEntries[meal])}
              onAdd={openCreateDialog}
              onEdit={openEditDialog}
              onDelete={setDeleteTarget}
            />
          ))
        : null}

      {isCreateOpen ? (
        <LogEntryFormDialog
          currentUser={currentUser}
          foods={foods}
          initialValues={{
            date: selectedDate,
            meal: createMeal,
            foodId: "",
            actualAmount: 0,
          }}
          resetKey={createResetKey}
          entry={null}
          isSaving={isSaving}
          error={formError}
          onCancel={closeCreateDialog}
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

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete Log Entry"
          description={`Delete ${deleteTarget.food?.name ?? "this entry"} from ${deleteTarget.meal}?`}
          isPending={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteEntry}
        />
      ) : null}
    </section>
  );
}
