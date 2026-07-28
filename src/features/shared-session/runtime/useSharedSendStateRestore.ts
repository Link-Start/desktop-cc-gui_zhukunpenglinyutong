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

import { sharedSessionV2TurnState } from "../services/sharedSessions";
import {
  getSharedSendState,
  getSharedSendStateRevision,
  markSharedSendRestoreFailure,
  restoreSharedSendStateFromTurnState,
} from "./sharedSendStateStore";
import { isSharedV2SendEnabled } from "./sharedV2SendFlag";

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
    void sharedSessionV2TurnState(workspaceId, threadId)
      .then((turnState) => {
        if (cancelled) {
          return;
        }
        // 竞态守护：fetch 期间用户可能已发起新发送。
        if (getSharedSendState(workspaceId, threadId).state !== "idle") {
          return;
        }
        restoreSharedSendStateFromTurnState(
          workspaceId,
          threadId,
          turnState,
          restoreRevision,
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        markSharedSendRestoreFailure(
          workspaceId,
          threadId,
          error instanceof Error ? error.message : String(error),
          restoreRevision,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, threadId, enabled]);
}
