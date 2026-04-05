import { useEffect, useMemo, useState } from "react";
import { type AddFromTemplateInput, type Food, type Meal, type TemplateWithItems, type User, meals } from "@shared/types";
import { formatNumber } from "../lib/format";
import { buildTemplatePreviewRows, getTemplateTotals } from "../lib/templates";
import { Dialog } from "./Dialog";

interface AddFromTemplateDialogProps {
  currentUser: User;
  foods: Food[];
  templates: TemplateWithItems[];
  initialValues: AddFromTemplateInput;
  resetKey?: string;
  isSaving: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (input: AddFromTemplateInput) => Promise<void>;
}

export function AddFromTemplateDialog({
  currentUser,
  foods,
  templates,
  initialValues,
  resetKey,
  isSaving,
  error,
  onCancel,
  onSubmit,
}: AddFromTemplateDialogProps) {
  const [formState, setFormState] = useState<AddFromTemplateInput>(initialValues);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFormState(initialValues);
    setValidationError("");
  }, [initialValues, resetKey]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === formState.templateId) ?? null,
    [templates, formState.templateId],
  );

  const previewRows = useMemo(
    () => buildTemplatePreviewRows(selectedTemplate, foods, formState.multiplier > 0 ? formState.multiplier : 0),
    [foods, formState.multiplier, selectedTemplate],
  );
  const totals = useMemo(() => getTemplateTotals(previewRows), [previewRows]);

  function updateField<K extends keyof AddFromTemplateInput>(field: K, value: AddFromTemplateInput[K]) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    if (templates.length === 0) {
      setValidationError("Create a template before using Add from Template.");
      return;
    }

    if (!formState.date) {
      setValidationError("Date is required.");
      return;
    }

    if (!formState.meal) {
      setValidationError("Meal is required.");
      return;
    }

    if (!formState.templateId) {
      setValidationError("Template is required.");
      return;
    }

    if (!(formState.multiplier > 0)) {
      setValidationError("Multiplier must be greater than 0.");
      return;
    }

    setValidationError("");
    await onSubmit(formState);
  }

  return (
    <Dialog
      title="Add from Template"
      description="Use a saved template to create one log entry per template row."
      onClose={onCancel}
      actions={
        <>
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || templates.length === 0}
          >
            {isSaving ? "Adding..." : "Add Entries"}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid--dialog">
        <label>
          <span>Current User</span>
          <input value={currentUser.name} readOnly />
        </label>

        <label>
          <span>Date</span>
          <input type="date" value={formState.date} onChange={(event) => updateField("date", event.target.value)} />
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
          <span>Template</span>
          <select value={formState.templateId} onChange={(event) => updateField("templateId", event.target.value)}>
            <option value="">{templates.length === 0 ? "No templates available" : "Select a template"}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Multiplier</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={formState.multiplier || ""}
            onChange={(event) => updateField("multiplier", Number(event.target.value))}
          />
        </label>

        <div className="nutrition-preview">
          <span className="eyebrow">Preview</span>
          {selectedTemplate ? (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Food</th>
                      <th>Default Amount</th>
                      <th>Final Amount</th>
                      <th>Calories</th>
                      <th>Protein</th>
                      <th>Fiber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={`${row.item.foodId}-${index}`}>
                        <td>{row.food?.name ?? "Unknown food"}</td>
                        <td>
                          {formatNumber(row.item.defaultAmount)} {row.food?.unitType ?? ""}
                        </td>
                        <td>
                          {formatNumber(row.finalAmount)} {row.food?.unitType ?? ""}
                        </td>
                        <td>{formatNumber(row.nutrition.calories)}</td>
                        <td>{formatNumber(row.nutrition.protein)}</td>
                        <td>{formatNumber(row.nutrition.fiber)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={3}>Totals</th>
                      <th>{formatNumber(totals.calories)}</th>
                      <th>{formatNumber(totals.protein)}</th>
                      <th>{formatNumber(totals.fiber)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <p className="nutrition-preview__meta">
              {templates.length === 0
                ? "No templates are available for this user yet."
                : "Select a template to preview the created entries."}
            </p>
          )}
        </div>

        {validationError || error ? <div className="form-error form-error--dialog">{validationError || error}</div> : null}
      </div>
    </Dialog>
  );
}
