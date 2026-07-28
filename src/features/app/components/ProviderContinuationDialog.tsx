import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import type { ProviderContinuationDialogState } from "../hooks/useSidebarMenus";

export function ProviderContinuationDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: ProviderContinuationDialogState | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const isRunning = state?.stage === "running";
  const isDegraded = state?.stage === "confirm-degraded";
  const hasError = state?.stage === "error";

  return (
    <AlertDialog
      open={Boolean(state)}
      onOpenChange={(open) => {
        if (!open && !isRunning) {
          onCancel();
        }
      }}
    >
      <AlertDialogPopup
        className="provider-continuation-dialog"
        bottomStickOnMobile={false}
        modalLayer
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDegraded
              ? t("threads.providerContinuationDegradedTitle", {
                  defaultValue: "续接历史需要降级",
                })
              : t("threads.providerContinuationTitle", {
                  defaultValue: "使用其他 Provider 继续",
                })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("threads.providerContinuationDescription", {
              defaultValue:
                "系统会保留来源会话，并创建一个独立的新会话承接后续工作。",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state ? (
          <div className="grid gap-4">
            <div className="rounded-lg border border-border/70 bg-muted/35 p-3">
              <div className="truncate text-sm font-medium">{state.sourceTitle}</div>
              <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{state.sourceLabel}</span>
                <ArrowRight className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {state.destinationLabel}
                </span>
              </div>
            </div>

            {state.detail ? (
              <pre
                className={`max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border p-3 text-xs ${
                  hasError
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-500/30 bg-amber-500/10 text-foreground"
                }`}
                role={hasError ? "alert" : "status"}
                aria-live="polite"
              >
                {state.detail}
              </pre>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {t("threads.providerContinuationSourcePreserved", {
                defaultValue:
                  "来源会话不会被修改。完成后可从新会话直接返回来源。",
              })}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <button
            type="button"
            className="ghost"
            onClick={onCancel}
            disabled={isRunning}
          >
            {hasError ? t("common.close") : t("common.cancel")}
          </button>
          {!hasError ? (
            <button
              type="button"
              className="primary"
              onClick={() => void onConfirm()}
              disabled={isRunning}
            >
              {isRunning
                ? t("threads.providerContinuationCreating", {
                    defaultValue: "正在创建…",
                  })
                : isDegraded
                  ? t("threads.providerContinuationConfirmDegraded", {
                      defaultValue: "接受降级并继续",
                    })
                  : t("threads.providerContinuationConfirm", {
                      defaultValue: "创建续接会话",
                    })}
            </button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
