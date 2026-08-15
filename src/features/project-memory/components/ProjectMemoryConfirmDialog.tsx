import { useTranslation } from "react-i18next";

type ProjectMemoryConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClassName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ProjectMemoryConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmClassName = "project-memory-action-btn danger",
  onCancel,
  onConfirm,
}: ProjectMemoryConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <div className="project-memory-confirm-dialog">
      <div className="project-memory-confirm-backdrop" onClick={onCancel} />
      <div className="project-memory-confirm-card">
        <h3 className="project-memory-confirm-title">{title}</h3>
        <p className="project-memory-confirm-message">{message}</p>
        <div className="project-memory-confirm-actions">
          <button type="button" className="project-memory-action-btn" onClick={onCancel}>
            {t("memory.cancel")}
          </button>
          <button type="button" className={confirmClassName} onClick={onConfirm}>
            {confirmLabel ?? t("memory.confirmDelete")}
          </button>
        </div>
      </div>
    </div>
  );
}
