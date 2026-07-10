import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "./alert-dialog";

type UnsavedChangesDialogProps = {
  open: boolean;
  isSaving?: boolean;
  onContinueEditing: () => void;
  onDiscard: () => void;
  onSaveAndClose: () => Promise<boolean>;
};

export function UnsavedChangesDialog({
  open,
  isSaving: isSavingExternally = false,
  onContinueEditing,
  onDiscard,
  onSaveAndClose,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();
  const [isSavingInternally, setIsSavingInternally] = useState(false);
  const isSaving = isSavingExternally || isSavingInternally;

  useEffect(() => {
    if (!open) {
      setIsSavingInternally(false);
    }
  }, [open]);

  const handleSaveAndClose = async () => {
    if (isSaving) {
      return;
    }
    setIsSavingInternally(true);
    try {
      await onSaveAndClose();
    } catch (error) {
      console.error("[UnsavedChangesDialog] Save-and-close failed", error);
    } finally {
      setIsSavingInternally(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving) {
          onContinueEditing();
        }
      }}
    >
      <AlertDialogPopup bottomStickOnMobile={false} modalLayer>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("files.unsavedChanges")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("files.unsavedChangesCloseDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            type="button"
            className="ghost"
            onClick={() => void handleSaveAndClose()}
            disabled={isSaving}
          >
            {isSaving ? t("files.saving") : t("files.saveAndClose")}
          </button>
          <button type="button" className="ghost" onClick={onContinueEditing} disabled={isSaving}>
            {t("files.continueEditing")}
          </button>
          <button type="button" className="primary" onClick={onDiscard} disabled={isSaving}>
            {t("files.discardChangesAction")}
          </button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
