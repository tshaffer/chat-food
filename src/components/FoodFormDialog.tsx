import { useEffect, useState, type FormEvent } from "react";
import type { Food, FoodInput } from "@shared/types";
import { Dialog } from "./Dialog";

const emptyForm: FoodInput = {
  name: "",
  unitQuantity: 1,
  unitType: "",
  caloriesPerUnit: 0,
  proteinPerUnit: 0,
  fiberPerUnit: 0,
};

interface FoodFormDialogProps {
  food: Food | null;
  isSaving: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (input: FoodInput) => Promise<void>;
}

export function FoodFormDialog({ food, isSaving, error, onCancel, onSubmit }: FoodFormDialogProps) {
  const [formState, setFormState] = useState<FoodInput>(emptyForm);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (food) {
      setFormState({
        name: food.name,
        unitQuantity: food.unitQuantity,
        unitType: food.unitType,
        caloriesPerUnit: food.caloriesPerUnit,
        proteinPerUnit: food.proteinPerUnit,
        fiberPerUnit: food.fiberPerUnit,
      });
    } else {
      setFormState(emptyForm);
    }
    setValidationError("");
  }, [food]);

  function updateNumberField(field: keyof FoodInput, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: Number(value),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.name.trim()) {
      setValidationError("Food name is required.");
      return;
    }

    if (!formState.unitType.trim()) {
      setValidationError("Unit type is required.");
      return;
    }

    if (!(formState.unitQuantity > 0)) {
      setValidationError("Unit quantity must be greater than 0.");
      return;
    }

    if (formState.caloriesPerUnit < 0 || formState.proteinPerUnit < 0 || formState.fiberPerUnit < 0) {
      setValidationError("Nutrition values cannot be negative.");
      return;
    }

    setValidationError("");
    await onSubmit(formState);
  }

  return (
    <Dialog
      title={food ? "Edit Food" : "Add Food"}
      description={
        food
          ? "Update the shared food definition used across templates and logs."
          : "Create a shared food that all users can log."
      }
      onClose={onCancel}
      actions={
        <>
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button--primary" form="food-form" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <form id="food-form" className="form-grid form-grid--dialog" onSubmit={handleSubmit}>
        <label>
          <span>Food</span>
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>

        <label>
          <span>Unit Quantity</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={formState.unitQuantity}
            onChange={(event) => updateNumberField("unitQuantity", event.target.value)}
            required
          />
        </label>

        <label>
          <span>Unit Type</span>
          <input
            value={formState.unitType}
            onChange={(event) => setFormState((current) => ({ ...current, unitType: event.target.value }))}
            required
          />
        </label>

        <label>
          <span>Calories per Unit</span>
          <input
            type="number"
            step="0.1"
            value={formState.caloriesPerUnit}
            onChange={(event) => updateNumberField("caloriesPerUnit", event.target.value)}
            required
          />
        </label>

        <label>
          <span>Protein per Unit</span>
          <input
            type="number"
            step="0.1"
            value={formState.proteinPerUnit}
            onChange={(event) => updateNumberField("proteinPerUnit", event.target.value)}
            required
          />
        </label>

        <label>
          <span>Fiber per Unit</span>
          <input
            type="number"
            step="0.1"
            value={formState.fiberPerUnit}
            onChange={(event) => updateNumberField("fiberPerUnit", event.target.value)}
            required
          />
        </label>

        {validationError || error ? <div className="form-error form-error--dialog">{validationError || error}</div> : null}
      </form>
    </Dialog>
  );
}
