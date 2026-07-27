/**
 * Shared Send UI 状态驱动 Store（Wave 4 / B.6，上游设计 §14.5）。
 *
 * 职责：为每个 Shared Thread 持有 `sendStateMachine` 的当前状态，
 * 事件经纯函数 `transition` 迁移；非法迁移返回 null 时直接忽略（幂等）。
 *
 * 形态沿用 `targetStore` 的 useSyncExternalStore 模块 store 惯例，
 * key 为 `${workspaceId}::${threadId}`（与 targetStore 的单冒号 key 区分，
 * 避免跨 store 误读）。
 *
 * 纪律：所有写入均为 best-effort——状态机驱动不得阻断发送链路。
 */

import { useSyncExternalStore } from "react";

import type { SharedV2TurnStateResult } from "../services/sharedSessions";
import {
  transition,
  type SharedSendEvent,
  type SharedSendState,
} from "../target/sendStateMachine";

/** degraded-context 的附加上下文（omissions/mode 等，Change C 接入编译层后填充）。 */
export type SharedSendDegradedInfo = { reason?: string } | null;

export type SharedSendStateEntry = {
  state: SharedSendState;
  degradedInfo: SharedSendDegradedInfo;
  /** target-unavailable 的不可用原因（Provider/Runtime unavailable），离开该态即清除。 */
  detail: string | null;
};

const IDLE_ENTRY: SharedSendStateEntry = {
  state: "idle",
  degradedInfo: null,
  detail: null,
};

type Listener = () => void;

function storeKeyOf(workspaceId: string, threadId: string): string {
  return `${workspaceId}::${threadId}`;
}

const entries = new Map<string, SharedSendStateEntry>();
const listeners = new Map<string, Set<Listener>>();

function readEntry(key: string): SharedSendStateEntry {
  return entries.get(key) ?? IDLE_ENTRY;
}

function writeEntry(key: string, next: SharedSendStateEntry): void {
  const prev = readEntry(key);
  if (Object.is(prev, next)) {
    return;
  }
  entries.set(key, next);
  listeners.get(key)?.forEach((listener) => listener());
}

/**
 * 应用一次状态机事件。非法迁移（transition 返回 null）直接忽略。
 * 进入 degraded-context 时记录 degradedInfo；离开即清除。
 */
export function dispatchSharedSendEvent(
  workspaceId: string,
  threadId: string,
  event: SharedSendEvent,
  options?: { degradedInfo?: SharedSendDegradedInfo; detail?: string | null },
): void {
  const key = storeKeyOf(workspaceId, threadId);
  const prev = readEntry(key);
  const nextState = transition(prev.state, event);
  if (nextState === null) {
    return;
  }
  const degradedInfo =
    nextState === "degraded-context"
      ? (options?.degradedInfo ?? prev.degradedInfo)
      : null;
  const detail =
    nextState === "target-unavailable"
      ? (options?.detail ?? prev.detail)
      : null;
  writeEntry(key, { state: nextState, degradedInfo, detail });
}

export function getSharedSendState(
  workspaceId: string,
  threadId: string,
): SharedSendStateEntry {
  return readEntry(storeKeyOf(workspaceId, threadId));
}

function subscribe(
  workspaceId: string,
  threadId: string,
  listener: Listener,
): () => void {
  const key = storeKeyOf(workspaceId, threadId);
  let bucket = listeners.get(key);
  if (!bucket) {
    bucket = new Set();
    listeners.set(key, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
  };
}

/** React hook：订阅指定 Shared Thread 的 send 状态。 */
export function useSharedSendState(
  workspaceId: string,
  threadId: string,
): SharedSendStateEntry {
  return useSyncExternalStore(
    (listener) => subscribe(workspaceId, threadId, listener),
    () => getSharedSendState(workspaceId, threadId),
    () => IDLE_ENTRY,
  );
}

/**
 * 重启恢复（6.5）：从 durable evidence（turn_state）重建 UI 状态，不落 idle。
 *
 * 映射规则（turn_state.inFlightAttempts 不带 accepted 标记，只能用 provisioning 证据）：
 * - 任一 Binding provisioningState === "recovery-required" → recovery-required；
 * - 否则存在 in-flight Attempt 且任一 Binding 仍 "creating"（begin 已落账、
 *   runtime ACK 已发生的证据）→ running；
 * - 否则存在 in-flight Attempt（ACK 在重启窗口丢失，无法区分）→ recovery-required
 *   （fail closed，禁止盲目放行）；
 * - 否则 → idle。
 */
export function restoreSharedSendStateFromTurnState(
  workspaceId: string,
  threadId: string,
  turnState: SharedV2TurnStateResult,
): void {
  const bindings = turnState.bindings ?? [];
  const hasRecoveryBinding = bindings.some(
    (binding) => binding.provisioningState === "recovery-required",
  );
  const hasInFlight = (turnState.inFlightAttempts ?? []).length > 0;
  const hasCreatingBinding = bindings.some(
    (binding) => binding.provisioningState === "creating",
  );
  let state: SharedSendState;
  if (hasRecoveryBinding) {
    state = "recovery-required";
  } else if (hasInFlight && hasCreatingBinding) {
    state = "running";
  } else if (hasInFlight) {
    state = "recovery-required";
  } else {
    state = "idle";
  }
  writeEntry(storeKeyOf(workspaceId, threadId), {
    state,
    degradedInfo: null,
    detail: null,
  });
}

/** 测试专用：清空全部 store 状态。 */
export function resetSharedSendStateStoreForTests(): void {
  entries.clear();
  listeners.clear();
}
