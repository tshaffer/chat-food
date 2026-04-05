import type { ReactNode } from "react";

interface DialogProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}

export function Dialog({ title, description, children, actions, onClose }: DialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__header">
          <div className="dialog__title-group">
            <h2>{title}</h2>
            {description ? <p className="dialog__description">{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            x
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        <div className="dialog__actions">{actions}</div>
      </div>
    </div>
  );
}
