/**
 * Shared Send 状态条（Wave 4 / B.6，上游设计 §14.5.3 UI Contract）。
 *
 * 按 `sendStateMachine` 九状态渲染 Composer 上方的提示条：
 * - `preparing-context` / `awaiting-acceptance` / `cancel-pending` / `settling`：只读提示；
 * - `degraded-context`：列出降级原因，未经确认不发送（继续 / 取消）；
 * - `recovery-required`：恢复卡片（Probe 定性 / 显式重建 Binding），锁定整个 Shared Session；
 * - `target-unavailable`：展示不可用原因，Picker 保持可更换。
 *
 * Cancel 能力（§14.5.2）：仅 `awaiting-acceptance` 且 Adapter 支持
 * `cancelPendingDelivery` 时可用；当前 V0 阻塞式发送链路不支持该 capability，
 * 因此禁用并说明原因（fail closed，不把 ambiguous 取消成未投递）。
 *
 * 纪律：本组件只做 UI 驱动；Probe / 重建均为显式用户动作，不自动重试。
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { pushErrorToast } from "../../../services/toasts";
import {
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
  resolveSharedDegradedContextDecision,
  useSharedSendState,
} from "../runtime/sharedSendStateStore";
import { isSharedV2SendEnabled } from "../runtime/sharedV2SendFlag";

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
  const [recoveryWork, setRecoveryWork] = useState<RecoveryWorkState>("idle");

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
        dispatchSharedSendEvent(workspaceId, threadId, { type: "probeActiveRun" });
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
    [workspaceId, threadId],
  );

  const handleProbe = useCallback(async () => {
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
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: `${t("sharedSend.recoveryProbe")}: ${recoveryErrorMessage(error)}`,
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

  const handleRebuild = useCallback(async () => {
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
      // 显式重建 = 用户取消 ambiguous Turn：recovery → settling → idle。
      dispatchSharedSendEvent(workspaceId, threadId, { type: "commitCancelled" });
      dispatchSharedSendEvent(workspaceId, threadId, { type: "canonicalCommitted" });
      setRecoveryWork("cleared");
    } catch (error) {
      setRecoveryWork("held");
      pushErrorToast({
        title: t("sharedSend.recoveryTitle"),
        message: `${t("sharedSend.recoveryRebuild")}: ${recoveryErrorMessage(error)}`,
        durationMs: 4800,
      });
    }
  }, [workspaceId, threadId, findRecoveryOwner, unlockSession, t]);

  if (!isSharedSession || !workspaceId || !threadId) {
    return null;
  }
  if (!isSharedV2SendEnabled()) {
    return null;
  }
  const { state, degradedInfo, detail } = entry;
  if (state === "idle" || state === "running") {
    // running 由既有 isProcessing UI 承担（§14.5.3 Active Target Badge 走 turnBadge）。
    return null;
  }

  const dispatch = (event: Parameters<typeof dispatchSharedSendEvent>[2]) => {
    dispatchSharedSendEvent(workspaceId, threadId, event);
  };

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

      {state === "degraded-context" && (
        <>
          <span className="shared-send-status__text">
            <strong>{t("sharedSend.degradedTitle")}</strong>
            {" · "}
            {t("sharedSend.degradedHint")}
            {degradedInfo?.mode ? ` [${degradedInfo.mode}]` : ""}
            {degradedInfo?.omissions?.length
              ? ` (${degradedInfo.omissions.join("; ")})`
              : degradedInfo?.reason
                ? ` (${degradedInfo.reason})`
                : ""}
            {typeof degradedInfo?.sourceEstimatedTokens === "number" &&
            typeof degradedInfo?.packageEstimatedTokens === "number"
              ? ` · ${degradedInfo.sourceEstimatedTokens} → ${degradedInfo.packageEstimatedTokens} estimated tokens`
              : ""}
            {degradedInfo?.dispositions?.length
              ? ` · ${Array.from(new Set(degradedInfo.dispositions)).join(", ")}`
              : ""}
          </span>
          <span className="shared-send-status__actions">
            <button
              type="button"
              className="shared-send-status__button"
              onClick={() => {
                if (
                  !resolveSharedDegradedContextDecision(
                    workspaceId,
                    threadId,
                    true,
                  )
                ) {
                  dispatch({ type: "degradedConfirmed" });
                }
              }}
            >
              {t("sharedSend.degradedConfirm")}
            </button>
            <button
              type="button"
              className="shared-send-status__button"
              onClick={() => {
                if (
                  !resolveSharedDegradedContextDecision(
                    workspaceId,
                    threadId,
                    false,
                  )
                ) {
                  dispatch({ type: "commitCancelled" });
                }
              }}
            >
              {t("sharedSend.cancel")}
            </button>
          </span>
        </>
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
            {recoveryWork === "held"
              ? t("sharedSend.recoveryProbeHeld")
              : recoveryWork === "cleared"
                ? t("sharedSend.recoveryProbeCleared")
                : t("sharedSend.recoveryHint")}
          </span>
          <span className="shared-send-status__actions">
            <button
              type="button"
              className="shared-send-status__button"
              disabled={recoveryWork === "working"}
              onClick={() => void handleProbe()}
            >
              {recoveryWork === "working"
                ? t("sharedSend.recoveryProbing")
                : t("sharedSend.recoveryProbe")}
            </button>
            <button
              type="button"
              className="shared-send-status__button"
              disabled={recoveryWork === "working"}
              onClick={() => void handleRebuild()}
            >
              {t("sharedSend.recoveryRebuild")}
            </button>
          </span>
        </>
      )}

      {state === "target-unavailable" && (
        <span className="shared-send-status__text">
          {detail
            ? t("sharedSend.targetUnavailableReason", { reason: detail })
            : t("sharedSend.targetUnavailable")}
        </span>
      )}
    </div>
  );
}
