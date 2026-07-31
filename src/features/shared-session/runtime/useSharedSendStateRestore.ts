/**
 * Shared Send 重启恢复 Hook（Wave 4 / B.6.5，上游设计 §14.5.6）。
 *
 * App 重启（或重新选中 Shared Thread）后，从 durable evidence
 * （`shared_session_v2_turn_state`）恢复 running / settling / recovery-required，
 * 而不是一律落回 idle。
 *
 * 纪律：
 * - 仅当 V2 flag 开启且当前 store 仍为 idle 时才恢复；等待期间若已有新发送
 *   推进状态（竞态窗口），放弃本次恢复（双重检查）。
 * - durable evidence 读取失败时 fail closed，进入 recovery-required；
 *   否则回到 idle 会允许重复发送未知 Attempt。
 */

import { useEffect } from "react";

import {
  sharedSessionV2RecoverAttempt,
  sharedSessionV2TurnState,
  type SharedV2TurnStateResult,
} from "../services/sharedSessions";
import {
  dispatchSharedSendEvent,
  getSharedSendActiveAttemptId,
  getSharedSendState,
  getSharedSendStateRevision,
  markSharedSendRestoreFailure,
  restoreSharedSendStateFromTurnState,
} from "./sharedSendStateStore";
import { reattachSharedSessionAttempt } from "./reattachSharedSessionAttempt";
import { isSharedV2SendEnabled } from "./sharedV2SendFlag";

function exactOwnedAcceptedAttempt(turnState: SharedV2TurnStateResult) {
  const owned = (turnState.inFlightAttempts ?? []).filter(
    (attempt) =>
      attempt.accepted === true &&
      attempt.runtimeObserverOwned === true &&
      Boolean(attempt.attemptId?.trim()),
  );
  return owned.length === 1 ? owned[0] : null;
}

function withoutRuntimeOwner(
  turnState: SharedV2TurnStateResult,
): SharedV2TurnStateResult {
  return {
    ...turnState,
    inFlightAttempts: (turnState.inFlightAttempts ?? []).map((attempt) => ({
      ...attempt,
      runtimeObserverOwned: false,
    })),
  };
}

export function useSharedSendStateRestore(
  workspaceId: string | null,
  threadId: string | null,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled || !workspaceId || !threadId) {
      return;
    }
    if (!isSharedV2SendEnabled()) {
      return;
    }
    if (getSharedSendState(workspaceId, threadId).state !== "idle") {
      return;
    }
    const restoreRevision = getSharedSendStateRevision(workspaceId, threadId);
    let cancelled = false;
    const canApplyRestore = () =>
      !cancelled &&
      getSharedSendState(workspaceId, threadId).state === "idle" &&
      getSharedSendStateRevision(workspaceId, threadId) === restoreRevision;
    void sharedSessionV2TurnState(workspaceId, threadId)
      .then(async (turnState) => {
        if (!canApplyRestore()) {
          return;
        }
        const ownedAttempt = exactOwnedAcceptedAttempt(turnState);
        const ownedAttemptId = ownedAttempt?.attemptId?.trim();
        if (!ownedAttempt || !ownedAttemptId) {
          restoreSharedSendStateFromTurnState(
            workspaceId,
            threadId,
            turnState,
            restoreRevision,
          );
          return;
        }
        if (
          !restoreSharedSendStateFromTurnState(
            workspaceId,
            threadId,
            withoutRuntimeOwner(turnState),
            restoreRevision,
          )
        ) {
          return;
        }
        const recoveryRevision = getSharedSendStateRevision(
          workspaceId,
          threadId,
        );
        const canApplyRecovery = () =>
          !cancelled &&
          getSharedSendState(workspaceId, threadId).state ===
            "recovery-required" &&
          getSharedSendActiveAttemptId(workspaceId, threadId) ===
            ownedAttemptId &&
          getSharedSendStateRevision(workspaceId, threadId) ===
            recoveryRevision;
        const recovery = await sharedSessionV2RecoverAttempt(
          workspaceId,
          threadId,
          ownedAttemptId,
        );
        if (!canApplyRecovery()) {
          return;
        }
        if (recovery.status === "active") {
          try {
            const observer = reattachSharedSessionAttempt(
              workspaceId,
              threadId,
              recovery,
            );
            void observer.catch((error: unknown) => {
              console.error(
                "[shared-session] restored terminal observer detached",
                error,
              );
            });
          } catch (error) {
            dispatchSharedSendEvent(workspaceId, threadId, {
              type: "connectionLost",
            });
            console.error(
              "[shared-session] failed to reattach restored Attempt",
              error,
            );
          }
          return;
        }
        if (recovery.status === "unknown") {
          return;
        }
        const refreshedTurnState = await sharedSessionV2TurnState(
          workspaceId,
          threadId,
        );
        if (!canApplyRecovery()) {
          return;
        }
        restoreSharedSendStateFromTurnState(
          workspaceId,
          threadId,
          refreshedTurnState,
          recoveryRevision,
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const marked = markSharedSendRestoreFailure(
          workspaceId,
          threadId,
          error instanceof Error ? error.message : String(error),
          restoreRevision,
        );
        if (!marked) {
          console.error("[shared-session] durable restore failed", error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, threadId, enabled]);
}
