import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Food, FoodInput } from "@shared/types";
import { api } from "../lib/api";
import { formatNumber } from "../lib/format";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FoodFormDialog } from "../components/FoodFormDialog";

export function FoodsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [foods, setFoods] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (searchParams.get("createFood") === "1") {
      setIsCreateOpen(true);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("createFood");
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function loadFoods() {
    setIsLoading(true);
    setError("");

    try {
      const nextFoods = await api.getFoods();
      setFoods(nextFoods);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load foods.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFoods();
  }, []);

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return foods;
    }

    return foods.filter((food) => food.name.toLowerCase().includes(normalizedQuery));
  }, [foods, query]);

  async function handleSave(input: FoodInput) {
    setIsSaving(true);
    setError("");

    try {
      if (editingFood) {
        const updatedFood = await api.updateFood(editingFood.id, input);
        setFoods((current) => current.map((food) => (food.id === updatedFood.id ? updatedFood : food)));
      } else {
        const createdFood = await api.createFood(input);
        setFoods((current) => [...current, createdFood]);
      }

      setEditingFood(null);
      setIsCreateOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save food.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await api.deleteFood(deleteTarget.id);
      setFoods((current) => current.filter((food) => food.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete food.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Shared foods</p>
          <h1>Foods</h1>
        </div>

        <div className="page-header__actions">
          <input
            className="search-input"
            placeholder="Search foods"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button button--primary" type="button" onClick={() => setIsCreateOpen(true)}>
            Add Food
          </button>
        </div>
      </header>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="card">
        {isLoading ? (
          <div className="empty-state compact">
            <h2>Loading foods</h2>
            <p>Fetching the shared food list.</p>
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="empty-state compact">
            <h2>No foods found</h2>
            <p>{query ? "No foods match the current filter." : "Create the first shared food to start logging meals."}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Unit Quantity</th>
                  <th>Unit Type</th>
                  <th>Calories per Unit</th>
                  <th>Protein per Unit</th>
                  <th>Fiber per Unit</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredFoods.map((food) => (
                  <tr key={food.id}>
                    <td>{food.name}</td>
                    <td>{formatNumber(food.unitQuantity)}</td>
                    <td>{food.unitType}</td>
                    <td>{formatNumber(food.caloriesPerUnit)}</td>
                    <td>{formatNumber(food.proteinPerUnit)}</td>
                    <td>{formatNumber(food.fiberPerUnit)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="button button--ghost" type="button" onClick={() => setEditingFood(food)}>
                          Edit
                        </button>
                        <button className="button button--ghost-danger" type="button" onClick={() => setDeleteTarget(food)}>
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

      {(isCreateOpen || editingFood) && (
        <FoodFormDialog
          food={editingFood}
          isSaving={isSaving}
          error={error}
          onCancel={() => {
            setEditingFood(null);
            setIsCreateOpen(false);
            setError("");
          }}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete Food"
          description={`Delete the shared food "${deleteTarget.name}"? This will only succeed if it is not referenced by any templates or log entries.`}
          isPending={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </section>
  );
}
