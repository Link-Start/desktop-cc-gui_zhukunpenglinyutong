import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import Check from "lucide-react/dist/esm/icons/check";
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

function activeStageIndex(state: ProviderContinuationDialogState): number {
  switch (state.progressPhase) {
    case "starting-target":
    case "delivering-context":
      return 1;
    case "verifying-target":
    case "finalizing":
    case "ready":
      return 2;
    default:
      return 0;
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
  const stageIndex = state ? activeStageIndex(state) : 0;
  const stages = [
    t("threads.providerContinuationStagePrepare", {
      defaultValue: "准备上下文",
    }),
    t("threads.providerContinuationStageDeliver", {
      defaultValue: "传递上下文",
    }),
    t("threads.providerContinuationStageVerify", {
      defaultValue: "校验目标",
    }),
  ];
  const progressMessage = (() => {
    switch (state?.progressPhase) {
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
  })();
  const formatTokens = (value: number | null) =>
    value === null ? "—" : new Intl.NumberFormat(i18n.language).format(value);

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
        className="provider-continuation-dialog max-w-xl"
        bottomStickOnMobile={false}
        modalLayer
      >
        <AlertDialogHeader className="gap-3 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]">
              <ArrowLeftRight className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <AlertDialogTitle>
                {t("threads.providerContinuationTitle", {
                  defaultValue: "使用其他 Provider 继续",
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("threads.providerContinuationDescription", {
                  defaultValue:
                    "来源会话保持不变，新会话将直接承接后续工作。",
                })}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {state ? (
          <div className="grid gap-4 px-6 pb-5">
            <section
              className="overflow-hidden rounded-xl border border-border/70 bg-muted/25"
              aria-label={t(
                "threads.providerContinuationContextAriaLabel",
                { defaultValue: "Provider 续接上下文" },
              )}
            >
              <div className="p-4">
                <div className="truncate text-sm font-semibold">
                  {state.sourceTitle}
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-xs">
                  <span className="truncate text-muted-foreground">
                    {state.sourceLabel}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate font-medium text-foreground">
                    {state.destinationLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border/60 bg-background/55 px-4 py-3 text-xs">
                <span className="text-muted-foreground">
                  {t("threads.providerContinuationEstimatedTokens", {
                    defaultValue: "可移植历史 Token → 续接包 Token",
                  })}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatTokens(state.sourceEstimatedTokens)}
                  <span className="px-2 text-muted-foreground">→</span>
                  {formatTokens(state.packageEstimatedTokens)}
                </span>
              </div>
            </section>

            <section
              className="rounded-xl border border-border/70 p-4"
              aria-label={t("threads.providerContinuationStagesAriaLabel", {
                defaultValue: "续接进度阶段",
              })}
            >
              <div className="grid grid-cols-3 gap-2">
                {stages.map((label, index) => {
                  const completed =
                    index < stageIndex ||
                    (index === 2 && state.progressPercent === 100);
                  const active = index === stageIndex;
                  return (
                    <div
                      key={label}
                      className="flex min-w-0 flex-col items-center gap-2 text-center"
                    >
                      <span
                        className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                          completed
                            ? "border-[#2563eb] bg-[#2563eb] text-white"
                            : active
                              ? "border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]"
                              : "border-border bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {completed ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span
                        className={`truncate text-xs ${
                          active || completed
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ${
                  hasError
                    ? "bg-destructive/10 text-destructive"
                    : "bg-[#2563eb]/10 text-foreground"
                }`}
                role={hasError ? "alert" : "status"}
                aria-live="polite"
              >
                {isBusy ? (
                  <LoaderCircle
                    className="size-4 shrink-0 animate-spin text-[#2563eb]"
                    aria-hidden
                  />
                ) : null}
                <span>{hasError ? state.detail : progressMessage}</span>
              </div>
            </section>

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

            <p className="text-xs text-muted-foreground">
              {t("threads.providerContinuationSourcePreserved", {
                defaultValue:
                  "来源会话不会被修改。完成后可从新会话直接返回来源。",
              })}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter className="flex-col gap-3 sm:flex-col sm:items-stretch">
          <div className="flex items-center gap-3">
            <Progress
              className="flex-1"
              value={state?.progressPercent ?? 0}
              aria-label={t("threads.providerContinuationProgressAriaLabel", {
                defaultValue: "Provider 续接进度",
              })}
            />
            <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {state?.progressPercent ?? 0}%
            </span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="ghost"
              onClick={onCancel}
            >
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
