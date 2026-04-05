import { useEffect, useMemo, useState } from "react";
import type {
  AddFromTemplateInput,
  Food,
  TemplateInput,
  TemplateItemInput,
  TemplateWithItems,
  User,
} from "@shared/types";
import { AddFromTemplateDialog } from "../components/AddFromTemplateDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { api } from "../lib/api";
import { getTodayDateString } from "../lib/date";
import { formatNumber } from "../lib/format";
import { enrichTemplateItems, getTemplateTotals } from "../lib/templates";

interface TemplatesPageProps {
  currentUser: User | null;
}

interface TemplateDraft {
  id: string | null;
  name: string;
  items: TemplateItemInput[];
}

function makeBlankDraft(): TemplateDraft {
  return {
    id: null,
    name: "New Template",
    items: [{ lineNumber: 1, foodId: "", defaultAmount: 0 }],
  };
}

export function TemplatesPage({ currentUser }: TemplatesPageProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TemplateDraft | null>(null);
  const [isTemplateLogOpen, setIsTemplateLogOpen] = useState(false);

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
      setTemplates([]);
      setSelectedId(null);
      setDraft(null);
      return;
    }

    const userId = currentUser.id;
    let cancelled = false;
    setIsLoading(true);
    setSelectedId(null);
    setDraft(null);

    async function loadTemplates() {
      try {
        const nextTemplates = await api.getTemplates(userId);
        if (cancelled) {
          return;
        }

        setTemplates(nextTemplates);
        setSelectedId((current) => current ?? nextTemplates[0]?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load templates.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const filteredTemplates = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return templates;
    }

    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [searchText, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  useEffect(() => {
    if (!draft && selectedTemplate) {
      setDraft({
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        items: selectedTemplate.items.map((item) => ({
          lineNumber: item.lineNumber,
          foodId: item.foodId,
          defaultAmount: item.defaultAmount,
        })),
      });
    }
  }, [draft, selectedTemplate]);

  const normalizedDraft = useMemo(() => {
    if (!draft) {
      return null;
    }

    return {
      ...draft,
      items: draft.items.map((item, index) => ({ ...item, lineNumber: index + 1 })),
    };
  }, [draft]);

  const enrichedDraftItems = useMemo(() => {
    if (!normalizedDraft) {
      return [];
    }

    return enrichTemplateItems(
      normalizedDraft.items.map((item, index) => ({
        id: `draft_${index}`,
        templateId: normalizedDraft.id ?? "draft",
        lineNumber: index + 1,
        foodId: item.foodId,
        defaultAmount: item.defaultAmount,
      })),
      foods,
    );
  }, [foods, normalizedDraft]);

  const draftTotals = useMemo(() => getTemplateTotals(enrichedDraftItems), [enrichedDraftItems]);

  const isDirty = useMemo(() => {
    if (!normalizedDraft) {
      return false;
    }

    if (!selectedTemplate) {
      return true;
    }

    const selectedComparable: TemplateDraft = {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      items: selectedTemplate.items.map((item) => ({
        lineNumber: item.lineNumber,
        foodId: item.foodId,
        defaultAmount: item.defaultAmount,
      })),
    };

    return JSON.stringify(normalizedDraft) !== JSON.stringify(selectedComparable);
  }, [normalizedDraft, selectedTemplate]);

  function selectTemplate(template: TemplateWithItems) {
    setSelectedId(template.id);
    setDraft({
      id: template.id,
      name: template.name,
      items: template.items.map((item) => ({
        lineNumber: item.lineNumber,
        foodId: item.foodId,
        defaultAmount: item.defaultAmount,
      })),
    });
    setFormError("");
  }

  function updateItem(index: number, patch: Partial<TemplateItemInput>) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextItems = current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
      return { ...current, items: nextItems };
    });
  }

  function moveItem(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.items.length) {
        return current;
      }

      const nextItems = current.items.slice();
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, item);
      return {
        ...current,
        items: nextItems.map((entry, itemIndex) => ({ ...entry, lineNumber: itemIndex + 1 })),
      };
    });
  }

  function buildTemplateInputFromDraft(currentDraft: TemplateDraft): TemplateInput | null {
    const name = currentDraft.name.trim();
    const items = currentDraft.items.map((item, index) => ({
      lineNumber: index + 1,
      foodId: item.foodId,
      defaultAmount: item.defaultAmount,
    }));

    if (!name) {
      setFormError("Template name is required.");
      return null;
    }

    if (items.length === 0) {
      setFormError("Templates need at least one item.");
      return null;
    }

    if (items.some((item) => !item.foodId || !(item.defaultAmount > 0))) {
      setFormError("Every template row needs a food and an amount greater than 0.");
      return null;
    }

    setFormError("");
    return { name, items };
  }

  async function refreshTemplates(nextSelectedId?: string | null) {
    if (!currentUser) {
      return;
    }

    const nextTemplates = await api.getTemplates(currentUser.id);
    setTemplates(nextTemplates);

    const selected = nextSelectedId ?? selectedId;
    if (selected) {
      const match = nextTemplates.find((template) => template.id === selected) ?? null;
      if (match) {
        selectTemplate(match);
        return;
      }
    }

    if (nextTemplates[0]) {
      selectTemplate(nextTemplates[0]);
    } else {
      setSelectedId(null);
      setDraft(null);
    }
  }

  async function handleSave() {
    if (!currentUser || !draft) {
      return;
    }

    const input = buildTemplateInputFromDraft(draft);
    if (!input) {
      return;
    }

    setIsSaving(true);

    try {
      if (draft.id) {
        const saved = await api.updateTemplate(draft.id, input);
        await refreshTemplates(saved.id);
      } else {
        const saved = await api.createTemplate(currentUser.id, input);
        await refreshTemplates(saved.id);
      }
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save template.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) {
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await api.deleteTemplate(deleteTarget.id);
      setDeleteTarget(null);
      await refreshTemplates(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete template.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleLogTemplate(input: AddFromTemplateInput) {
    if (!currentUser) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await api.addEntriesFromTemplate(currentUser.id, input);
      setIsTemplateLogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to log template.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!currentUser) {
    return <div className="empty-state">Select a user to manage templates.</div>;
  }

  return (
    <section className="stack templates-page">
      <div className="templates-layout">
        <aside className="card templates-sidebar">
          <div className="templates-sidebar__header">
            <div>
              <p className="eyebrow">Reusable meals</p>
              <h1>Templates</h1>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setSelectedId(null);
                setDraft(makeBlankDraft());
                setFormError("");
              }}
            >
              New Template
            </button>
          </div>

          <input
            className="search-input"
            placeholder="Search templates"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />

          <div className="template-list">
            {isLoading ? (
              <div className="empty-state compact">
                <p>Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="empty-state compact">
                <p>No templates found.</p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  className={template.id === selectedId ? "template-list__item template-list__item--active" : "template-list__item"}
                  type="button"
                  onClick={() => selectTemplate(template)}
                >
                  <strong>{template.name}</strong>
                  <span>{template.items.length} foods</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="card template-editor">
          {!draft ? (
            <div className="empty-state">
              <h2>No template selected</h2>
              <p>Create a new template or choose one from the list.</p>
            </div>
          ) : (
            <div className="stack">
              <div className="template-editor__header">
                <label className="template-name-field">
                  <span className="eyebrow">Template Name</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                  />
                </label>
                <div className="page-header__actions">
                  {isDirty ? <span className="status-chip">Unsaved changes</span> : null}
                  <button className="button button--primary" type="button" onClick={() => void handleSave()} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="button button--danger-soft"
                    type="button"
                    onClick={() => setDeleteTarget(draft)}
                    disabled={!draft.id}
                  >
                    Delete
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setIsTemplateLogOpen(true)}
                    disabled={!draft.id}
                  >
                    Log this Template
                  </button>
                </div>
              </div>

              {error ? <div className="banner banner--error">{error}</div> : null}
              {formError ? <div className="banner banner--error">{formError}</div> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Food</th>
                      <th>Default Amount</th>
                      <th>Calories</th>
                      <th>Protein</th>
                      <th>Fiber</th>
                      <th>Reorder</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item, index) => {
                      const enriched = enrichedDraftItems[index];

                      return (
                        <tr key={`${draft.id ?? "draft"}-${index}`}>
                          <td>{index + 1}</td>
                          <td>
                            <select value={item.foodId} onChange={(event) => updateItem(index, { foodId: event.target.value })}>
                              <option value="">Select a food</option>
                              {foods.map((food) => (
                                <option key={food.id} value={food.id}>
                                  {food.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.defaultAmount || ""}
                              onChange={(event) => updateItem(index, { defaultAmount: Number(event.target.value) })}
                            />
                          </td>
                          <td>{formatNumber(enriched?.nutrition.calories ?? 0)}</td>
                          <td>{formatNumber(enriched?.nutrition.protein ?? 0)}</td>
                          <td>{formatNumber(enriched?.nutrition.fiber ?? 0)}</td>
                          <td>
                            <div className="table-actions">
                              <button className="button button--ghost" type="button" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                                Up
                              </button>
                              <button
                                className="button button--ghost"
                                type="button"
                                onClick={() => moveItem(index, 1)}
                                disabled={index === draft.items.length - 1}
                              >
                                Down
                              </button>
                            </div>
                          </td>
                          <td>
                            <button
                              className="button button--ghost-danger"
                              type="button"
                              onClick={() =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        items: current.items
                                          .filter((_, itemIndex) => itemIndex !== index)
                                          .map((entry, itemIndex) => ({ ...entry, lineNumber: itemIndex + 1 })),
                                      }
                                    : current,
                                )
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={3}>Totals</th>
                      <th>{formatNumber(draftTotals.calories)}</th>
                      <th>{formatNumber(draftTotals.protein)}</th>
                      <th>{formatNumber(draftTotals.fiber)}</th>
                      <th colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            items: [
                              ...current.items,
                              { lineNumber: current.items.length + 1, foodId: "", defaultAmount: 0 },
                            ],
                          }
                        : current,
                    )
                  }
                >
                  Add Food to Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete Template"
          description={`Delete ${deleteTarget.name}? Existing log entries will be kept.`}
          isPending={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {isTemplateLogOpen && draft?.id ? (
        <AddFromTemplateDialog
          currentUser={currentUser}
          foods={foods}
          templates={templates}
          initialValues={{ date: getTodayDateString(), meal: "Breakfast", templateId: draft.id, multiplier: 1 }}
          isSaving={isSaving}
          error={formError}
          onCancel={() => {
            setIsTemplateLogOpen(false);
            setFormError("");
          }}
          onSubmit={handleLogTemplate}
        />
      ) : null}
    </section>
  );
}
