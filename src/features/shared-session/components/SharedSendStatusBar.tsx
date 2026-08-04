/**
 * Shared Send 状态条（Wave 4 / B.6 + recovery exit closure）。
 *
 * 按 `sendStateMachine` 九状态渲染 Composer 上方的提示条：
 * - `preparing-context` / `awaiting-acceptance` / `cancel-pending` / `settling`：只读提示；
 * - `degraded-context`：legacy transient state，不渲染阻塞确认；
 * - `recovery-required`：恢复卡片（Probe / Stop / 停止并重建 / 放弃本轮），锁定整个 Shared Session；
 * - `target-unavailable`：展示不可用原因，Picker 保持可更换。
 *
 * Cancel 能力（§14.5.2）：仅 `awaiting-acceptance` 且 Adapter 支持
 * `cancelPendingDelivery` 时可用；当前 V0 阻塞式发送链路不支持该 capability，
 * 因此禁用并说明原因（fail closed，不把 ambiguous 取消成未投递）。
 *
 * 纪律：本组件只做 UI 驱动；Probe / Stop / Rebuild / Abandon 均为显式用户动作，不自动重试。
 * Recovery Exit Ladder（§14.5.7）：fail-closed 锁定 + completable exit。
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { pushErrorToast } from "../../../services/toasts";
import {
  sharedSessionV2AbandonUnresolvedAttempt,
  sharedSessionV2InterruptTurn,
  sharedSessionV2ProbeBinding,
  sharedSessionV2RecoverAttempt,
  sharedSessionV2RebuildBinding,
  sharedSessionV2TurnState,
} from "../services/sharedSessions";
import {
  canCancel,
  sharedAdapterCapabilities,
} from "../target/sendStateMachine";
import { useSharedTargetState } from "../target/targetStore";
import {
  dispatchSharedSendEvent,
  useSharedSendState,
} from "../runtime/sharedSendStateStore";
import { reattachSharedSessionAttempt } from "../runtime/reattachSharedSessionAttempt";
import { isSharedV2SendEnabled } from "../runtime/sharedV2SendFlag";
import { isSharedRecoveryExitV2Enabled } from "../runtime/sharedRecoveryExitFlag";
import { classifyRecoveryError } from "../runtime/recoveryErrorMap";

type SharedSendStatusBarProps = {
  workspaceId: string | null;
  threadId: string | null;
  isSharedSession: boolean;
};

type RecoveryWorkState = "idle" | "working" | "held" | "cleared";

type RecoveryOwner =
  | { kind: "attempt"; attemptId: string; bindingKey: string }
  | { kind: "binding"; bindingKey: string }
  | { kind: "clear" }
  | { kind: "ambiguous" };

function recoveryErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

function mapRecoveryErrorToast(
  t: (key: string, params?: Record<string, unknown>) => string,
  actionLabel: string,
  error: unknown,
): string {
  const { kind, raw } = classifyRecoveryError(error);
  switch (kind) {
    case "recovery-active":
      return t("sharedSend.recoveryErrorActive");
    case "recovery-active-requires-stop":
      return t("sharedSend.recoveryErrorActiveRequiresStop");
    case "recovery-owner-ambiguous":
      return t("sharedSend.recoveryErrorAmbiguous");
    case "recovery-owner-missing":
      return t("sharedSend.recoveryErrorOwnerMissing");
    default:
      return `${actionLabel}: ${raw}`;
  }
}

export function SharedSendStatusBar({
  workspaceId,
  threadId,
  isSharedSession,
}: SharedSendStatusBarProps) {
  const { t } = useTranslation();
  const entry = useSharedSendState(workspaceId ?? "", threadId ?? "");
  const targetState = useSharedTargetState(workspaceId ?? "", threadId ?? "");
  const adapterCapabilities = sharedAdapterCapabilities(
    targetState.activeTurnTarget?.engine ??
      targetState.selectedNextTarget?.engine,
  );
  const exitLadderEnabled = isSharedRecoveryExitV2Enabled();
  const [recoveryWork, setRecoveryWork] = useState<RecoveryWorkState>("idle");
  const [lastErrorDetail, setLastErrorDetail] = useState<string | null>(null);
  const [runtimeReleased, setRuntimeReleased] = useState(false);

  const findRecoveryOwner = useCallback(async (): Promise<RecoveryOwner> => {
    if (!workspaceId || !threadId) {
      return { kind: "ambiguous" };
    }
    const turnState = await sharedSessionV2TurnState(workspaceId, threadId);
    const inFlight = turnState.inFlightAttempts ?? [];
    if (inFlight.length > 1) {
      return { kind: "ambiguous" };
    }
    const attempt = inFlight[0];
    if (attempt) {
      const attemptId = attempt.attemptId?.trim();
      const bindingKey = attempt.bindingKey?.trim();
      return attemptId && bindingKey
        ? { kind: "attempt", attemptId, bindingKey }
        : { kind: "ambiguous" };
    }
    const recoveryBindings = (turnState.bindings ?? []).filter(
      (binding) => binding.provisioningState === "recovery-required",
    );
    if (recoveryBindings.length > 1) {
      return { kind: "ambiguous" };
    }
    const bindingKey = recoveryBindings[0]?.bindingKey?.trim();
    return bindingKey
      ? { kind: "binding", bindingKey }
      : { kind: "clear" };
  }, [workspaceId, threadId]);

  const unlockSession = useCallback(() => {
    if (!workspaceId || !threadId) {
      return;
    }
    // 证据定性为「无可投递 Turn」：recovery → settling → idle。
    dispatchSharedSendEvent(workspaceId, threadId, { type: "probeNotAccepted" });
    dispatchSharedSendEvent(workspaceId, threadId, { type: "canonicalCommitted" });
    setRuntimeReleased(false);
    setLastErrorDetail(null);
  }, [workspaceId, threadId]);

  const settleCancelled = useCallback(() => {
    if (!workspaceId || !threadId) {
      return;
    }
    dispatchSharedSendEvent(workspaceId, threadId, { type: "commitCancelled" });
    dispatchSharedSendEvent(workspaceId, threadId, { type: "canonicalCommitted" });
    setRuntimeReleased(false);
    setLastErrorDetail(null);
  }, [workspaceId, threadId]);

  const recoverAttemptOwner = useCallback(
    async (attemptId: string) => {
      if (!workspaceId || !threadId) {
        return;
      }
      const recovery = await sharedSessionV2RecoverAttempt(
        workspaceId,
        threadId,
        attemptId,
      );
      if (recovery.status === "active") {
        const observer = reattachSharedSessionAttempt(
          workspaceId,
          threadId,
          recovery,
        );
        void observer
          .then((commit) => {
            if (commit.terminal.recoveryReason) {
              setRecoveryWork("held");
            }
          })
          .catch((error: unknown) => {
            setRecoveryWork("held");
            setLastErrorDetail(recoveryErrorMessage(error));
            pushErrorToast({
              title: t("sharedSend.recoveryTitle"),
              message: mapRecoveryErrorToast(
                t,
                t("sharedSend.recoveryProbe"),
                error,
              ),
              durationMs: 4800,
            });
          });
        setRecoveryWork("cleared");
        return;
      }
      if (recovery.status === "unknown") {
        setRecoveryWork("held");
        return;
      }
      dispatchSharedSendEvent(workspaceId, threadId, {
        type:
          recovery.status === "terminal-committed"
            ? "probeTerminalRun"
            : "probeNotAccepted",
      });
      dispatchSharedSendEvent(workspaceId, threadId, {
        type: "canonicalCommitted",
      });
      setRecoveryWork("cleared");
    },
    [workspaceId, threadId, t],
  );

  const handleProbe = useCallback(async () => {
    if (!workspaceId || !threadId) {
      return;
    }
    setRecoveryWork("working");
    setLastErrorDetail(null);
    try {
      const owner = await findRecoveryOwner();
      if (owner.kind === "clear") {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      if (owner.kind === "ambiguous") {
        setRecoveryWork("held");
        setLastErrorDetail(t("sharedSend.recoveryErrorAmbiguous"));
        return;
      }
      if (owner.kind === "attempt") {
        await recoverAttemptOwner(owner.attemptId);
        return;
      }
      const bindingProbe = await sharedSessionV2ProbeBinding(
        workspaceId,
        threadId,
        owner.bindingKey,
      );
      if (bindingProbe.inFlightAttempts.length !== 1) {
        setRecoveryWork("held");
        return;
      }
      const attemptId = bindingProbe.inFlightAttempts[0]?.attemptId?.trim();
      if (!attemptId) {
        setRecoveryWork("held");
        return;
      }
      await recoverAttemptOwner(attemptId);
    } catch (error) {
      // Probe 失败保持锁定，并把真实失败暴露给用户。
      setRecoveryWork("held");
      setLastErrorDetail(recoveryErrorMessage(error));
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: mapRecoveryErrorToast(t, t("sharedSend.recoveryProbe"), error),
        durationMs: 4800,
      });
    }
  }, [
    workspaceId,
    threadId,
    findRecoveryOwner,
    recoverAttemptOwner,
    unlockSession,
    t,
  ]);

  const handleStop = useCallback(async () => {
    if (!workspaceId || !threadId) {
      return;
    }
    setRecoveryWork("working");
    setLastErrorDetail(null);
    try {
      const owner = await findRecoveryOwner();
      if (owner.kind === "clear") {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      if (owner.kind !== "attempt") {
        setRecoveryWork("held");
        setLastErrorDetail(t("sharedSend.recoveryStopNoAttempt"));
        pushErrorToast({
          title: t("sharedSend.recoveryTitle"),
          message: t("sharedSend.recoveryStopNoAttempt"),
          durationMs: 4200,
        });
        return;
      }
      const result = await sharedSessionV2InterruptTurn(
        workspaceId,
        threadId,
        owner.attemptId,
      );
      if (result.status === "terminal-committed") {
        dispatchSharedSendEvent(workspaceId, threadId, {
          type: "probeTerminalRun",
        });
        dispatchSharedSendEvent(workspaceId, threadId, {
          type: "canonicalCommitted",
        });
        setRecoveryWork("cleared");
        return;
      }
      // Stop 成功 ≠ idle：仅标记 runtime 可能已释放，仍停在 recovery-required。
      setRuntimeReleased(true);
      setRecoveryWork("held");
    } catch (error) {
      setRecoveryWork("held");
      setLastErrorDetail(recoveryErrorMessage(error));
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: mapRecoveryErrorToast(t, t("sharedSend.recoveryStop"), error),
        durationMs: 4800,
      });
    }
  }, [workspaceId, threadId, findRecoveryOwner, unlockSession, t]);

  const handleStopAndRebuild = useCallback(async () => {
    if (!workspaceId || !threadId) {
      return;
    }
    setRecoveryWork("working");
    setLastErrorDetail(null);
    try {
      const owner = await findRecoveryOwner();
      if (owner.kind === "clear") {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      if (owner.kind === "ambiguous") {
        setRecoveryWork("held");
        setLastErrorDetail(t("sharedSend.recoveryErrorAmbiguous"));
        return;
      }
      if (owner.kind === "attempt") {
        try {
          const interruptResult = await sharedSessionV2InterruptTurn(
            workspaceId,
            threadId,
            owner.attemptId,
          );
          if (interruptResult.status === "terminal-committed") {
            dispatchSharedSendEvent(workspaceId, threadId, {
              type: "probeTerminalRun",
            });
            dispatchSharedSendEvent(workspaceId, threadId, {
              type: "canonicalCommitted",
            });
            setRecoveryWork("cleared");
            return;
          }
          setRuntimeReleased(true);
        } catch {
          // best-effort stop；rebuild 仍可能 recovery-active，交给下方错误映射。
        }
      }
      await sharedSessionV2RebuildBinding(
        workspaceId,
        threadId,
        owner.bindingKey,
      );
      settleCancelled();
      setRecoveryWork("cleared");
    } catch (error) {
      setRecoveryWork("held");
      setLastErrorDetail(recoveryErrorMessage(error));
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: mapRecoveryErrorToast(
          t,
          t("sharedSend.recoveryStopAndRebuild"),
          error,
        ),
        durationMs: 5200,
      });
    }
  }, [
    workspaceId,
    threadId,
    findRecoveryOwner,
    unlockSession,
    settleCancelled,
    t,
  ]);

  const handleRebuild = useCallback(async () => {
    // 旧双按钮路径 / 或用户已 Stop 后的纯重建。
    if (exitLadderEnabled) {
      await handleStopAndRebuild();
      return;
    }
    if (!workspaceId || !threadId) {
      return;
    }
    setRecoveryWork("working");
    try {
      const owner = await findRecoveryOwner();
      if (owner.kind === "clear") {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      if (owner.kind === "ambiguous") {
        setRecoveryWork("held");
        return;
      }
      await sharedSessionV2RebuildBinding(
        workspaceId,
        threadId,
        owner.bindingKey,
      );
      settleCancelled();
      setRecoveryWork("cleared");
    } catch (error) {
      setRecoveryWork("held");
      setLastErrorDetail(recoveryErrorMessage(error));
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: mapRecoveryErrorToast(
          t,
          t("sharedSend.recoveryRebuild"),
          error,
        ),
        durationMs: 4800,
      });
    }
  }, [
    exitLadderEnabled,
    handleStopAndRebuild,
    workspaceId,
    threadId,
    findRecoveryOwner,
    unlockSession,
    settleCancelled,
    t,
  ]);

  const handleAbandon = useCallback(async () => {
    if (!workspaceId || !threadId) {
      return;
    }
    const confirmed = window.confirm(t("sharedSend.recoveryAbandonConfirm"));
    if (!confirmed) {
      return;
    }
    setRecoveryWork("working");
    setLastErrorDetail(null);
    try {
      const owner = await findRecoveryOwner();
      if (owner.kind === "clear") {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      if (owner.kind === "ambiguous") {
        setRecoveryWork("held");
        setLastErrorDetail(t("sharedSend.recoveryErrorAmbiguous"));
        pushErrorToast({
          title: t("sharedSend.recoveryTitle"),
          message: t("sharedSend.recoveryErrorAmbiguous"),
          durationMs: 4800,
        });
        return;
      }
      if (owner.kind === "binding") {
        // 无 in-flight attempt 时放弃本轮等价于 probe-not-accepted 解锁；
        // binding 损坏请用重建。
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      // 用户已确认放弃：forceStop=true，尽量先 interrupt 再 durable cancel。
      const result = await sharedSessionV2AbandonUnresolvedAttempt(
        workspaceId,
        threadId,
        {
          attemptId: owner.attemptId,
          forceStop: true,
        },
      );
      if (result.status === "clear") {
        unlockSession();
      } else {
        settleCancelled();
      }
      setRecoveryWork("cleared");
    } catch (error) {
      setRecoveryWork("held");
      setLastErrorDetail(recoveryErrorMessage(error));
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: mapRecoveryErrorToast(
          t,
          t("sharedSend.recoveryAbandon"),
          error,
        ),
        durationMs: 5200,
      });
    }
  }, [
    workspaceId,
    threadId,
    findRecoveryOwner,
    unlockSession,
    settleCancelled,
    t,
  ]);

  if (!isSharedSession || !workspaceId || !threadId) {
    return null;
  }
  if (!isSharedV2SendEnabled()) {
    return null;
  }
  const { state, detail } = entry;
  if (
    state === "idle" ||
    state === "running" ||
    state === "degraded-context"
  ) {
    // running 由既有 isProcessing UI 承担（§14.5.3 Active Target Badge 走 turnBadge）。
    // degraded-context 仅兼容旧内存状态；新发送不会进入该阻塞态。
    return null;
  }

  const dispatch = (event: Parameters<typeof dispatchSharedSendEvent>[2]) => {
    dispatchSharedSendEvent(workspaceId, threadId, event);
  };

  const recoveryHintText =
    recoveryWork === "held"
      ? runtimeReleased
        ? t("sharedSend.recoveryHintAfterStop")
        : t("sharedSend.recoveryProbeHeld")
      : recoveryWork === "cleared"
        ? t("sharedSend.recoveryProbeCleared")
        : t("sharedSend.recoveryHint");

  const busy = recoveryWork === "working";

  return (
    <div
      className={`shared-send-status shared-send-status--${state}`}
      role="status"
      data-testid="shared-send-status"
    >
      {state === "preparing-context" && (
        <span className="shared-send-status__text">
          {t("sharedSend.preparingContext")}
        </span>
      )}

      {state === "awaiting-acceptance" && (
        <>
          <span className="shared-send-status__text">
            {t("sharedSend.awaitingAcceptance")}
          </span>
          <span className="shared-send-status__actions">
            <button
              type="button"
              className="shared-send-status__button"
              disabled={
                !canCancel(state, adapterCapabilities.cancelPendingDelivery)
              }
              title={t("sharedSend.cancelUnsupported")}
              onClick={() => dispatch({ type: "cancelRequested" })}
            >
              {t("sharedSend.cancel")}
            </button>
          </span>
        </>
      )}

      {state === "cancel-pending" && (
        <span className="shared-send-status__text">
          {t("sharedSend.cancelPending")}
        </span>
      )}

      {state === "settling" && (
        <span className="shared-send-status__text">
          {t("sharedSend.settling")}
        </span>
      )}

      {state === "recovery-required" && (
        <>
          <span className="shared-send-status__text">
            <strong>{t("sharedSend.recoveryTitle")}</strong>
            {" · "}
            {recoveryHintText}
            {lastErrorDetail ? (
              <span
                className="shared-send-status__details"
                data-testid="shared-send-recovery-detail"
                title={lastErrorDetail}
              >
                {" "}
                ({t("sharedSend.recoveryTechDetail")})
              </span>
            ) : null}
          </span>
          <span className="shared-send-status__actions">
            <button
              type="button"
              className="shared-send-status__button"
              disabled={busy}
              onClick={() => void handleProbe()}
            >
              {busy
                ? t("sharedSend.recoveryProbing")
                : t("sharedSend.recoveryProbe")}
            </button>
            {exitLadderEnabled ? (
              <>
                <button
                  type="button"
                  className="shared-send-status__button"
                  disabled={busy}
                  onClick={() => void handleStop()}
                  title={t("sharedSend.recoveryStopHint")}
                >
                  {t("sharedSend.recoveryStop")}
                </button>
                <button
                  type="button"
                  className="shared-send-status__button"
                  disabled={busy}
                  onClick={() => void handleStopAndRebuild()}
                  title={t("sharedSend.recoveryStopAndRebuildHint")}
                >
                  {t("sharedSend.recoveryStopAndRebuild")}
                </button>
                <button
                  type="button"
                  className="shared-send-status__button shared-send-status__button--danger"
                  disabled={busy}
                  onClick={() => void handleAbandon()}
                  title={t("sharedSend.recoveryAbandonHint")}
                >
                  {t("sharedSend.recoveryAbandon")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="shared-send-status__button"
                disabled={busy}
                onClick={() => void handleRebuild()}
              >
                {t("sharedSend.recoveryRebuild")}
              </button>
            )}
          </span>
        </>
      )}

      {state === "target-unavailable" && (
        <span className="shared-send-status__text">
          {detail
            ? t("sharedSend.targetUnavailableReason", { reason: detail })
            : t("sharedSend.targetUnavailable")}
          {" · "}
          {t("sharedSend.targetUnavailableHint")}
        </span>
      )}
    </div>
  );
}
