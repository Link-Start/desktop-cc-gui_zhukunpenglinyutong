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

import type { EngineType } from "../../../types/engine";
import {
  sharedSessionV2ProbeBinding,
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

/** bindingKey = `${engine}:${providerProfileId|"default"}`（与 Rust `shared_target_binding_key` 对齐）。 */
function parseBindingKey(bindingKey: string): {
  engine: EngineType | null;
  providerProfileId: string | null;
} {
  const separator = bindingKey.indexOf(":");
  if (separator <= 0) {
    return { engine: null, providerProfileId: null };
  }
  const engine = bindingKey.slice(0, separator) as EngineType;
  const provider = bindingKey.slice(separator + 1).trim();
  return {
    engine,
    providerProfileId: provider && provider !== "default" ? provider : null,
  };
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

  const findRecoveryBindingKey = useCallback(async (): Promise<string | null> => {
    if (!workspaceId || !threadId) {
      return null;
    }
    const turnState = await sharedSessionV2TurnState(workspaceId, threadId);
    const recovery = (turnState.bindings ?? []).find(
      (binding) => binding.provisioningState === "recovery-required",
    );
    return recovery?.bindingKey ?? null;
  }, [workspaceId, threadId]);

  const unlockSession = useCallback(() => {
    if (!workspaceId || !threadId) {
      return;
    }
    // 证据定性为「无可投递 Turn」：recovery → settling → idle。
    dispatchSharedSendEvent(workspaceId, threadId, { type: "probeNotAccepted" });
    dispatchSharedSendEvent(workspaceId, threadId, { type: "canonicalCommitted" });
  }, [workspaceId, threadId]);

  const handleProbe = useCallback(async () => {
    if (!workspaceId || !threadId) {
      return;
    }
    setRecoveryWork("working");
    try {
      const bindingKey = await findRecoveryBindingKey();
      if (!bindingKey) {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      const evidence = await sharedSessionV2ProbeBinding(
        workspaceId,
        threadId,
        bindingKey,
      );
      const hasAcceptedInFlight = (evidence.inFlightAttempts ?? []).some(
        (attempt) => attempt.accepted,
      );
      const nativeProbeStatus = evidence.nativeProbe?.status ?? "unknown";
      if (hasAcceptedInFlight && nativeProbeStatus === "matched") {
        dispatchSharedSendEvent(workspaceId, threadId, { type: "probeActiveRun" });
        setRecoveryWork("cleared");
        return;
      }
      if (
        hasAcceptedInFlight ||
        nativeProbeStatus === "matched" ||
        nativeProbeStatus === "runtime-unhealthy"
      ) {
        // runtime 仍持有 identity 或 durable ACK 已存在，不能把 Attempt 当成未投递。
        setRecoveryWork("held");
        return;
      }
      unlockSession();
      setRecoveryWork("cleared");
    } catch {
      // Probe 失败保持锁定，不误导用户。
      setRecoveryWork("idle");
    }
  }, [workspaceId, threadId, findRecoveryBindingKey, unlockSession]);

  const handleRebuild = useCallback(async () => {
    if (!workspaceId || !threadId) {
      return;
    }
    setRecoveryWork("working");
    try {
      const bindingKey = await findRecoveryBindingKey();
      if (!bindingKey) {
        unlockSession();
        setRecoveryWork("cleared");
        return;
      }
      const { engine, providerProfileId } = parseBindingKey(bindingKey);
      if (!engine) {
        setRecoveryWork("idle");
        return;
      }
      await sharedSessionV2RebuildBinding(workspaceId, threadId, {
        bindingKey,
        engine,
        providerProfileId,
      });
      // 显式重建 = 用户取消 ambiguous Turn：recovery → settling → idle。
      dispatchSharedSendEvent(workspaceId, threadId, { type: "commitCancelled" });
      dispatchSharedSendEvent(workspaceId, threadId, { type: "canonicalCommitted" });
      setRecoveryWork("cleared");
    } catch {
      setRecoveryWork("idle");
    }
  }, [workspaceId, threadId, findRecoveryBindingKey, unlockSession]);

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
