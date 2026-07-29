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
 * 纪律：`tryAcquireSharedSend` 是本地线性发送的 admission gate；只有它能从
 * `idle` 原子进入 `preparing-context`。其余状态事件仍为幂等驱动，不得绕过 gate。
 */

import { useSyncExternalStore } from "react";

import type {
  SharedContextOmission,
  SharedV2TurnStateResult,
} from "../services/sharedSessions";
import {
  transition,
  type SharedSendEvent,
  type SharedSendState,
} from "../target/sendStateMachine";

/** degraded-context 的附加上下文（omissions/mode 等，Change C 接入编译层后填充）。 */
export type SharedSendDegradedInfo = {
  reason?: string;
  /** Tx1 后 actual package identity；preview 阶段为空。 */
  packageId?: string;
  sourceChecksum?: string;
  mode?: string;
  structuredOmissions?: SharedContextOmission[];
  /** 旧版/未知后端响应的展示 fallback。 */
  omissions?: string[];
  dispositions?: string[];
  sourceEstimatedTokens?: number;
  packageEstimatedTokens?: number;
} | null;

export type SharedSendStateEntry = {
  state: SharedSendState;
  degradedInfo: SharedSendDegradedInfo;
  /** target-unavailable 的不可用原因（Provider/Runtime unavailable），离开该态即清除。 */
  detail: string | null;
};

export type SharedSendAcquireResult =
  | {
      acquired: true;
      state: "preparing-context";
      /** 本次 admission 的单调 identity；只能被 V2 orchestrator 消费一次。 */
      revision: number;
    }
  | {
      acquired: false;
      state: Exclude<SharedSendState, "idle">;
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
const revisions = new Map<string, number>();
const pendingAdmissionRevisions = new Map<string, number>();
const activeAttemptIds = new Map<string, string>();
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
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
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
  if (nextState === "idle") {
    activeAttemptIds.delete(key);
  }
  if (nextState !== "preparing-context") {
    pendingAdmissionRevisions.delete(key);
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

/**
 * Shared Turn 的同步 admission gate。
 *
 * JavaScript 在首个 await 前单线程执行；先写状态、后通知 listener，可保证同步重入
 * 或同一 event-loop turn 内的第二个 caller 只能观察到 non-idle 并被拒绝。
 */
export function tryAcquireSharedSend(
  workspaceId: string,
  threadId: string,
): SharedSendAcquireResult {
  const currentState = getSharedSendState(workspaceId, threadId).state;
  if (currentState !== "idle") {
    return { acquired: false, state: currentState };
  }
  dispatchSharedSendEvent(workspaceId, threadId, { type: "send" });
  const key = storeKeyOf(workspaceId, threadId);
  const revision = revisions.get(key) ?? 0;
  pendingAdmissionRevisions.set(key, revision);
  return { acquired: true, state: "preparing-context", revision };
}

/**
 * 把 Composer 提前取得的 admission 交给 V2 orchestrator。
 *
 * exact revision + preparing-context + 未消费三项同时满足才成功；重复消费、旧 caller
 * 或跨完整 send cycle 的 revision 一律 fail closed。
 */
export function consumeSharedSendAdmission(
  workspaceId: string,
  threadId: string,
  revision: number,
): boolean {
  const key = storeKeyOf(workspaceId, threadId);
  if (
    readEntry(key).state !== "preparing-context" ||
    (revisions.get(key) ?? 0) !== revision ||
    pendingAdmissionRevisions.get(key) !== revision
  ) {
    return false;
  }
  pendingAdmissionRevisions.delete(key);
  return true;
}

/**
 * Composer 在 handoff 前同步失败时释放自己的 admission。
 *
 * 只有 exact、尚未消费的 revision 可释放，禁止误解锁另一个 caller 或已开始的 Attempt。
 */
export function releaseSharedSendAdmission(
  workspaceId: string,
  threadId: string,
  revision: number,
): boolean {
  const key = storeKeyOf(workspaceId, threadId);
  if (
    readEntry(key).state !== "preparing-context" ||
    (revisions.get(key) ?? 0) !== revision ||
    pendingAdmissionRevisions.get(key) !== revision
  ) {
    return false;
  }
  pendingAdmissionRevisions.delete(key);
  dispatchSharedSendEvent(workspaceId, threadId, { type: "commitCancelled" });
  dispatchSharedSendEvent(workspaceId, threadId, { type: "canonicalCommitted" });
  return true;
}

/** Restore stale-response guard：值可回到 idle，但 revision 只单调前进。 */
export function getSharedSendStateRevision(
  workspaceId: string,
  threadId: string,
): number {
  return revisions.get(storeKeyOf(workspaceId, threadId)) ?? 0;
}

/**
 * Shared V2 control plane owner。
 *
 * 只保存 Tx1 已落盘的 attempt identity；Interrupt/Recovery 不得从当前 Picker、
 * active UI turn 或 mutable target 反推 owner。
 */
export function setSharedSendActiveAttempt(
  workspaceId: string,
  threadId: string,
  attemptId: string | null,
): void {
  const key = storeKeyOf(workspaceId, threadId);
  const normalizedAttemptId = attemptId?.trim();
  if (normalizedAttemptId) {
    activeAttemptIds.set(key, normalizedAttemptId);
  } else {
    activeAttemptIds.delete(key);
  }
}

export function getSharedSendActiveAttemptId(
  workspaceId: string,
  threadId: string,
): string | null {
  return activeAttemptIds.get(storeKeyOf(workspaceId, threadId)) ?? null;
}

/** Durable restore 失败时禁止把未知 in-flight 状态伪装成 idle。 */
export function markSharedSendRestoreFailure(
  workspaceId: string,
  threadId: string,
  detail: string,
  expectedRevision?: number,
): boolean {
  const key = storeKeyOf(workspaceId, threadId);
  if (
    expectedRevision !== undefined &&
    getSharedSendStateRevision(workspaceId, threadId) !== expectedRevision
  ) {
    return false;
  }
  if (readEntry(key).state !== "idle") {
    return false;
  }
  writeEntry(key, {
    state: "recovery-required",
    degradedInfo: null,
    detail,
  });
  return true;
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
 * 映射规则：
 * - 任一 Binding provisioningState === "recovery-required" → recovery-required；
 * - 否则存在 durable `turnAccepted` 且 Rust lifecycle owner 仍在线的 Attempt → running；
 * - accepted 但 owner 已随进程重启丢失 → recovery-required，等待 Probe 定性；
 * - 否则存在 in-flight Attempt（只有 `turnRequested`，无法证明 runtime 已接收）
 *   → recovery-required
 *   （fail closed，禁止盲目放行）；
 * - 否则 → idle。
 */
export function restoreSharedSendStateFromTurnState(
  workspaceId: string,
  threadId: string,
  turnState: SharedV2TurnStateResult,
  expectedRevision?: number,
): boolean {
  const key = storeKeyOf(workspaceId, threadId);
  if (
    expectedRevision !== undefined &&
    getSharedSendStateRevision(workspaceId, threadId) !== expectedRevision
  ) {
    return false;
  }
  const bindings = turnState.bindings ?? [];
  const hasRecoveryBinding = bindings.some(
    (binding) => binding.provisioningState === "recovery-required",
  );
  const inFlightAttempts = turnState.inFlightAttempts ?? [];
  const hasInFlight = inFlightAttempts.length > 0;
  const hasOwnedAcceptedInFlight =
    inFlightAttempts.length === 1 &&
    inFlightAttempts[0]?.accepted === true &&
    inFlightAttempts[0]?.runtimeObserverOwned === true;
  let state: SharedSendState;
  if (hasRecoveryBinding) {
    state = "recovery-required";
  } else if (hasOwnedAcceptedInFlight) {
    state = "running";
  } else if (hasInFlight) {
    state = "recovery-required";
  } else {
    state = "idle";
  }
  const inFlightAttemptIds = [
    ...new Set(
      inFlightAttempts
        .map((attempt) => attempt.attemptId?.trim())
        .filter((attemptId): attemptId is string => Boolean(attemptId)),
    ),
  ];
  if (inFlightAttemptIds.length === 1) {
    activeAttemptIds.set(key, inFlightAttemptIds[0]);
  } else {
    // 多个未决 attempt 不能猜 owner；后续 control operation 必须 fail closed。
    activeAttemptIds.delete(key);
  }
  writeEntry(key, {
    state,
    degradedInfo: null,
    detail: null,
  });
  return true;
}

/** 测试专用：清空全部 store 状态。 */
export function resetSharedSendStateStoreForTests(): void {
  entries.clear();
  revisions.clear();
  pendingAdmissionRevisions.clear();
  activeAttemptIds.clear();
  listeners.clear();
}
