import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { Progress } from "../../../components/ui/progress";
import type { ProviderContinuationDialogState } from "../hooks/useSidebarMenus";

function resolveProgressMessage(
  phase: ProviderContinuationDialogState["progressPhase"] | undefined,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  switch (phase) {
    case "reading-source":
      return t("threads.providerContinuationProgressReading", {
        defaultValue: "正在读取来源会话…",
      });
    case "compiling-context":
      return t("threads.providerContinuationProgressCompiling", {
        defaultValue: "正在整理可续接上下文…",
      });
    case "prepared":
      return t("threads.providerContinuationProgressPrepared", {
        defaultValue: "上下文已准备，确认后直接续接",
      });
    case "starting-target":
      return t("threads.providerContinuationProgressStarting", {
        defaultValue: "正在启动目标 Provider…",
      });
    case "delivering-context":
      return t("threads.providerContinuationProgressDelivering", {
        defaultValue: "正在传递上下文…",
      });
    case "verifying-target":
      return t("threads.providerContinuationProgressVerifying", {
        defaultValue: "正在校验目标会话…",
      });
    case "finalizing":
      return t("threads.providerContinuationProgressFinalizing", {
        defaultValue: "正在完成会话登记…",
      });
    case "ready":
      return t("threads.providerContinuationProgressReady", {
        defaultValue: "续接完成",
      });
    default:
      return t("threads.providerContinuationProgressWaiting", {
        defaultValue: "等待准备上下文",
      });
  }
}

export function ProviderContinuationDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: ProviderContinuationDialogState | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const { t, i18n } = useTranslation();
  const isPreparing = state?.stage === "preparing";
  const isRunning = state?.stage === "running";
  const isBusy = isPreparing || isRunning;
  const hasError = state?.stage === "error";
  const retryingPrepare = hasError && state.retryAction === "prepare";
  const progressMessage = resolveProgressMessage(state?.progressPhase, t);
  const formatTokens = (value: number) =>
    new Intl.NumberFormat(i18n.language).format(value);
  const hasTokenEstimate =
    state !== null &&
    state.sourceEstimatedTokens !== null &&
    state.packageEstimatedTokens !== null;

  return (
    <AlertDialog
      open={Boolean(state)}
      onOpenChange={(open) => {
        // running 阶段也允许关闭：放弃本次续接 UI 接管，不硬中止后端。
        if (!open) {
          onCancel();
        }
      }}
    >
      <AlertDialogPopup
        className="provider-continuation-dialog max-w-md"
        bottomStickOnMobile={false}
        modalLayer
      >
        <AlertDialogHeader className="gap-3 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                hasError
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-border/60 bg-primary/10 text-primary"
              }`}
            >
              {hasError ? (
                <AlertCircle className="size-5" aria-hidden />
              ) : (
                <ArrowLeftRight className="size-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <AlertDialogTitle>
                {hasError
                  ? t("threads.providerContinuationFailedTitle", {
                      defaultValue: "续接没有完成",
                    })
                  : t("threads.providerContinuationTitle", {
                      defaultValue: "使用其他 Provider 继续",
                    })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {hasError
                  ? t("threads.providerContinuationFailedDescription", {
                      defaultValue: "来源会话保持不变，可以安全重试。",
                    })
                  : t("threads.providerContinuationDescription", {
                      defaultValue:
                        "来源会话保持不变，新会话将直接承接后续工作。",
                    })}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {state ? (
          <div className="grid gap-3 px-6 pb-4">
            <section
              className="overflow-hidden rounded-xl border border-border/70 bg-muted/20"
              aria-label={t("threads.providerContinuationContextAriaLabel", {
                defaultValue: "Provider 续接上下文",
              })}
            >
              <div className="space-y-3 p-3.5">
                <div className="truncate text-sm font-semibold leading-tight">
                  {state.sourceTitle}
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                  <div className="min-w-0 rounded-lg border border-border/60 bg-background/70 px-2.5 py-2">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("threads.providerContinuationFromLabel", {
                        defaultValue: "来源",
                      })}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {state.sourceLabel}
                    </div>
                  </div>
                  <div className="flex items-center justify-center self-center">
                    <ArrowRight
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 rounded-lg border border-border/60 bg-background/70 px-2.5 py-2">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("threads.providerContinuationToLabel", {
                        defaultValue: "目标",
                      })}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-foreground">
                      {state.destinationLabel}
                    </div>
                  </div>
                </div>
              </div>

              {hasTokenEstimate ? (
                <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-background/50 px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    {t("threads.providerContinuationEstimatedTokens", {
                      defaultValue: "上下文 Token",
                    })}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatTokens(state.sourceEstimatedTokens as number)}
                    <span className="px-1.5 text-muted-foreground">→</span>
                    {formatTokens(state.packageEstimatedTokens as number)}
                  </span>
                </div>
              ) : isBusy && !hasError ? (
                <div className="border-t border-border/60 bg-background/50 px-3.5 py-2.5 text-xs text-muted-foreground">
                  {t("threads.providerContinuationTokensEstimating", {
                    defaultValue: "正在估算上下文…",
                  })}
                </div>
              ) : null}
            </section>

            {hasError ? (
              <div
                className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 leading-relaxed">
                  {state.detail ??
                    t("threads.providerContinuationRecoveryRequired", {
                      defaultValue:
                        "续接未完成，已进入恢复状态。请保留当前会话后重试。",
                    })}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-foreground"
                role="status"
                aria-live="polite"
              >
                {isBusy ? (
                  <LoaderCircle
                    className="size-3.5 shrink-0 animate-spin text-primary"
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0 leading-relaxed">{progressMessage}</span>
              </div>
            )}

            {hasError && state.technicalDetail ? (
              <details className="rounded-lg border border-border/70 px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">
                  {t("threads.providerContinuationTechnicalDetail", {
                    defaultValue: "技术详情",
                  })}
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                  {state.technicalDetail}
                </pre>
              </details>
            ) : null}

            {!hasError ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("threads.providerContinuationSourcePreserved", {
                  defaultValue:
                    "来源会话不会被修改。完成后可从新会话直接返回来源。",
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter className="flex-col gap-3 sm:flex-col sm:items-stretch">
          {isBusy && !hasError ? (
            <Progress
              className="w-full"
              value={state?.progressPercent ?? 0}
              aria-label={t("threads.providerContinuationProgressAriaLabel", {
                defaultValue: "Provider 续接进度",
              })}
            />
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="ghost" onClick={onCancel}>
              {hasError ? t("common.close") : t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void onConfirm()}
              disabled={isBusy}
            >
              {isPreparing
                ? t("threads.providerContinuationPreparing", {
                    defaultValue: "正在准备…",
                  })
                : isRunning
                  ? t("threads.providerContinuationContinuing", {
                      defaultValue: "正在续接…",
                    })
                  : retryingPrepare
                    ? t("threads.providerContinuationRetryPrepare", {
                        defaultValue: "重新准备",
                      })
                    : hasError
                      ? t("threads.providerContinuationRetry", {
                          defaultValue: "重试校验",
                        })
                      : t("threads.providerContinuationContinue", {
                          defaultValue: "继续",
                        })}
            </button>
          </div>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
