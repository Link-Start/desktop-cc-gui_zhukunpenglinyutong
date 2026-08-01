import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "./alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** 必填：radix AlertDialog 需要 Description 才能对屏幕阅读器可访问 */
  body: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除等）时确认按钮使用 destructive 配色 */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 轻量通用二次确认弹窗（radix AlertDialog 受控封装）。
 * 用于替代 window.confirm —— 后者在 macOS Tauri (WKWebView) 下会静默返回 false。
 * 模式参照 UnsavedChangesDialog，按钮复用全局 .ghost / .primary 样式。
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmText,
  cancelText,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogPopup bottomStickOnMobile={false} modalLayer>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button type="button" className="ghost" onClick={onCancel}>
            {cancelText ?? t("common.cancel")}
          </button>
          <button
            type="button"
            className={cn("primary", danger && "bg-destructive text-white hover:bg-destructive/90")}
            onClick={onConfirm}
          >
            {confirmText ?? t("common.confirm")}
          </button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
