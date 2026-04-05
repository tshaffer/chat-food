import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  title: string;
  description: string;
  isPending: boolean;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  isPending,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button--danger" type="button" onClick={() => void onConfirm()} disabled={isPending}>
            {isPending ? "Working..." : confirmLabel}
          </button>
        </>
      }
    >
      <p>{description}</p>
    </Dialog>
  );
}
