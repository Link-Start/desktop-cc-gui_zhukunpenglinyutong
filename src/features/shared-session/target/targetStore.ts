/**
 * Shared Target Store（Wave 4 / B.1）。
 *
 * 每个 Shared Thread 一份：`selectedNextTarget`（可变，只影响下一次 Send）
 * 与 `activeTurnTarget`（Turn 创建时固化的不可变快照）严格分离。
 * Picker 只能改 `selectedNextTarget`；禁止用它改写进行中/已完成 Turn 的 Badge。
 *
 * 形态沿用 `activeCanvasStore` 的 useSyncExternalStore 模块 store 惯例。
 */

import { useSyncExternalStore } from "react";

import type { ExecutionTarget, TurnExecutionSnapshot } from "./types";

export type SharedTargetState = {
  selectedNextTarget: ExecutionTarget | null;
  activeTurnTarget: TurnExecutionSnapshot | null;
};

const EMPTY_STATE: SharedTargetState = {
  selectedNextTarget: null,
  activeTurnTarget: null,
};

type Listener = () => void;

function storeKeyOf(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

const states = new Map<string, SharedTargetState>();
const listeners = new Map<string, Set<Listener>>();

function readState(key: string): SharedTargetState {
  return states.get(key) ?? EMPTY_STATE;
}

function writeState(key: string, next: SharedTargetState): void {
  const prev = readState(key);
  if (Object.is(prev, next)) {
    return;
  }
  states.set(key, next);
  listeners.get(key)?.forEach((listener) => listener());
}

/** 更新下一次发送的目标选择（唯一允许用户修改的入口）。 */
export function selectNextTarget(
  workspaceId: string,
  threadId: string,
  target: ExecutionTarget,
): void {
  const key = storeKeyOf(workspaceId, threadId);
  writeState(key, { ...readState(key), selectedNextTarget: target });
}

/** Turn 创建时固化 active 快照；此后不可变。 */
export function beginTurn(
  workspaceId: string,
  threadId: string,
  snapshot: TurnExecutionSnapshot,
): void {
  const key = storeKeyOf(workspaceId, threadId);
  writeState(key, { ...readState(key), activeTurnTarget: snapshot });
}

/** Turn 到达终态后清除 active 快照（历史 Badge 由 turn fact 承担，不读 store）。 */
export function endTurn(workspaceId: string, threadId: string): void {
  const key = storeKeyOf(workspaceId, threadId);
  const state = readState(key);
  if (state.activeTurnTarget === null) {
    return;
  }
  writeState(key, { ...state, activeTurnTarget: null });
}

export function getSharedTargetState(
  workspaceId: string,
  threadId: string,
): SharedTargetState {
  return readState(storeKeyOf(workspaceId, threadId));
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

/** React hook：订阅指定 Shared Thread 的 target 状态。 */
export function useSharedTargetState(
  workspaceId: string,
  threadId: string,
): SharedTargetState {
  return useSyncExternalStore(
    (listener) => subscribe(workspaceId, threadId, listener),
    () => getSharedTargetState(workspaceId, threadId),
    () => EMPTY_STATE,
  );
}

/** 测试专用：清空全部 store 状态。 */
export function resetSharedTargetStoreForTests(): void {
  states.clear();
  listeners.clear();
}
