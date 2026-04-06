import { useState } from "react";
import { Dialog } from "./Dialog";

interface AddUserDialogProps {
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function AddUserDialog({ onClose, onSubmit }: AddUserDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter a user name.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSubmit(trimmedName);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create user.");
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      title="Add User"
      description="Create a new user profile. User names must be unique."
      onClose={isSaving ? () => undefined : onClose}
      actions={
        <>
          <button className="button button--secondary" type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="button button--primary" type="button" onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Create User"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>
          <span>User Name</span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter a unique user name"
            disabled={isSaving}
          />
        </label>

        {error ? <div className="form-error form-error--dialog">{error}</div> : null}
      </div>
    </Dialog>
  );
}
