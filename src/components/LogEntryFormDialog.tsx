import { useEffect, useMemo, useState } from "react";
import { calculateNutrition, roundNutritionValue } from "@shared/nutrition";
import type { Food, LogEntry, LogEntryInput, Meal, User } from "@shared/types";
import { meals } from "@shared/types";
import { formatNumber } from "../lib/format";
import { Dialog } from "./Dialog";

interface LogEntryFormDialogProps {
  currentUser: User;
  foods: Food[];
  initialValues: LogEntryInput;
  resetKey?: string;
  entry: LogEntry | null;
  isSaving: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (input: LogEntryInput, options?: { addAnother?: boolean }) => Promise<void>;
  onDelete?: () => void;
}

export function LogEntryFormDialog({
  currentUser,
  foods,
  initialValues,
  resetKey,
  entry,
  isSaving,
  error,
  onCancel,
  onSubmit,
  onDelete,
}: LogEntryFormDialogProps) {
  const [formState, setFormState] = useState<LogEntryInput>(initialValues);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFormState(initialValues);
    setValidationError("");
  }, [initialValues, resetKey]);

  const selectedFood = useMemo(
    () => foods.find((food) => food.id === formState.foodId) ?? null,
    [foods, formState.foodId],
  );

  const preview = useMemo(() => {
    if (!selectedFood || formState.actualAmount <= 0) {
      return { calories: 0, protein: 0, fiber: 0 };
    }

    const nutrition = calculateNutrition(selectedFood, formState.actualAmount);
    return {
      calories: roundNutritionValue(nutrition.calories),
      protein: roundNutritionValue(nutrition.protein),
      fiber: roundNutritionValue(nutrition.fiber),
    };
  }, [selectedFood, formState.actualAmount]);

  function validate(): boolean {
    if (!formState.date) {
      setValidationError("Date is required.");
      return false;
    }

    if (!formState.meal) {
      setValidationError("Meal is required.");
      return false;
    }

    if (!formState.foodId) {
      setValidationError("Food is required.");
      return false;
    }

    if (!(formState.actualAmount > 0)) {
      setValidationError("Amount must be greater than 0.");
      return false;
    }

    setValidationError("");
    return true;
  }

  async function handleSubmit(addAnother = false) {
    if (!validate()) {
      return;
    }

    await onSubmit(formState, { addAnother });
  }

  function updateField<K extends keyof LogEntryInput>(field: K, value: LogEntryInput[K]) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog
      title={entry ? "Edit Food Entry" : "Add Food Entry"}
      onClose={onCancel}
      actions={
        <>
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          {entry && onDelete ? (
            <button className="button button--danger-soft" type="button" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          {!entry ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save and Add Another"}
            </button>
          ) : null}
          <button className="button button--primary" type="button" onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>
          <span>Current User</span>
          <input value={currentUser.name} readOnly />
        </label>

        <label>
          <span>Date</span>
          <input
            type="date"
            value={formState.date}
            onChange={(event) => updateField("date", event.target.value)}
            required
          />
        </label>

        <label>
          <span>Meal</span>
          <select value={formState.meal} onChange={(event) => updateField("meal", event.target.value as Meal)}>
            {meals.map((meal) => (
              <option key={meal} value={meal}>
                {meal}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Food</span>
          <select value={formState.foodId} onChange={(event) => updateField("foodId", event.target.value)}>
            <option value="">Select a food</option>
            {foods.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={formState.actualAmount || ""}
            onChange={(event) => updateField("actualAmount", Number(event.target.value))}
            required
          />
        </label>

        <div className="nutrition-preview">
          <span className="eyebrow">Nutrition Preview</span>
          <div className="nutrition-preview__grid">
            <div>
              <strong>{formatNumber(preview.calories)}</strong>
              <span>Calories</span>
            </div>
            <div>
              <strong>{formatNumber(preview.protein)}</strong>
              <span>Protein</span>
            </div>
            <div>
              <strong>{formatNumber(preview.fiber)}</strong>
              <span>Fiber</span>
            </div>
          </div>
          {selectedFood ? (
            <p className="nutrition-preview__meta">
              {formatNumber(formState.actualAmount || 0)} {selectedFood.unitType} of {selectedFood.name}
            </p>
          ) : null}
        </div>

        {validationError || error ? <div className="form-error">{validationError || error}</div> : null}
      </div>
    </Dialog>
  );
}
