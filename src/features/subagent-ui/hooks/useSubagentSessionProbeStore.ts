import { useSyncExternalStore } from "react";
import type { ConversationItem } from "../../../types";
import { getSubagentInspectorSelection, syncSubagentInspectorSelection } from "./useSubagentInspectorStore";
import { resolveSubagentProgress } from "../utils/subagentViewModel";

type Listener = () => void;

type ThreadProcessingHint = {
  isProcessing?: boolean;
};

type ProbeSnapshot = {
  itemsByThread: Record<string, ConversationItem[]>;
  statusById: Record<string, ThreadProcessingHint>;
};

/**
 * 抽屉旁路加载的子会话 transcript / 终态提示。
 *
 * 不写 threads reducer：layout 每帧会用 options.threadItemsByThread 整包覆盖
 * activeCanvasStore，旁路写 store 会被冲掉。此 module store 作为 enrich 的补充源。
 */
let itemsByThread: Record<string, ConversationItem[]> = {};
let statusById: Record<string, ThreadProcessingHint> = {};
let version = 0;
const listeners = new Set<Listener>();

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function itemHasAssistantText(items: ConversationItem[]): boolean {
  return items.some(
    (item) =>
      item.kind === "message" &&
      item.role === "assistant" &&
      typeof item.text === "string" &&
      item.text.trim().length > 0,
  );
}

function itemLooksFailed(items: ConversationItem[]): boolean {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) {
      continue;
    }
    if (item.kind === "tool") {
      const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
      if (/(fail|error|abort|timeout|cancel)/.test(status)) {
        return true;
      }
    }
    if (item.kind === "message" && item.role === "assistant") {
      const text = typeof item.text === "string" ? item.text : "";
      if (/outcome\s*=\s*["']?(failed|error)["']?/i.test(text) || /\[failed\]/i.test(text)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 抽屉（或其它旁路）加载到子会话 items 后写入，驱动小队卡 / inspector status 升级。
 */
export function publishSubagentSessionProbe(
  threadId: string,
  items: ConversationItem[],
): void {
  const id = threadId.trim();
  if (!id || items.length === 0) {
    return;
  }

  const previousItems = itemsByThread[id];
  // 已有更完整 live 缓存且 probe 不更长时不降级
  if (
    previousItems &&
    previousItems.length >= items.length &&
    itemHasAssistantText(previousItems)
  ) {
    return;
  }

  const nextItems = items;
  const failed = itemLooksFailed(nextItems);
  const finished = itemHasAssistantText(nextItems) || failed;
  const nextStatus: ThreadProcessingHint = finished
    ? { isProcessing: false }
    : { isProcessing: true };

  const itemsUnchanged =
    previousItems === nextItems ||
    (previousItems != null &&
      previousItems.length === nextItems.length &&
      previousItems.every((item, index) => item === nextItems[index]));
  const prevStatus = statusById[id];
  const statusUnchanged =
    prevStatus?.isProcessing === nextStatus.isProcessing;

  if (itemsUnchanged && statusUnchanged) {
    return;
  }

  itemsByThread = { ...itemsByThread, [id]: nextItems };
  statusById = { ...statusById, [id]: nextStatus };
  emit();
  // 抽屉已打开时，即使小队列表未 re-enrich，也直接推 inspector status
  syncInspectorSelectionFromProbe(id, failed, finished);
}

function syncInspectorSelectionFromProbe(
  threadId: string,
  failed: boolean,
  finished: boolean,
): void {
  if (!finished) {
    return;
  }
  const selected = getSubagentInspectorSelection();
  if (!selected) {
    return;
  }
  const sessionId = selected.sessionThreadId?.trim() ?? "";
  const taskThreadId = selected.taskOutput?.threadId?.trim() ?? "";
  if (sessionId !== threadId && taskThreadId !== threadId && selected.id !== threadId) {
    return;
  }
  if (selected.status === "completed" || selected.status === "error") {
    return;
  }
  const nextStatus = failed ? ("error" as const) : ("completed" as const);
  syncSubagentInspectorSelection({
    ...selected,
    status: nextStatus,
    progress: resolveSubagentProgress(nextStatus, selected.toolCount),
  });
}

export function getSubagentSessionProbeSnapshot(): ProbeSnapshot {
  return { itemsByThread, statusById };
}

export function clearSubagentSessionProbeStore(): void {
  if (
    Object.keys(itemsByThread).length === 0 &&
    Object.keys(statusById).length === 0
  ) {
    return;
  }
  itemsByThread = {};
  statusById = {};
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion() {
  return version;
}

/**
 * 订阅 probe 变更（返回 version 数字，保证 useSyncExternalStore 比较稳定）。
 */
export function useSubagentSessionProbeVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}

/**
 * 合并 canvas 源与 probe 旁路源，供 enrichSubagentCardStatuses 使用。
 * probe 仅在 canvas 缺 items / 缺 assistant 终态证据时补洞。
 */
export function mergeSubagentEnrichmentSources(options?: {
  statusById?: Record<string, ThreadProcessingHint | undefined>;
  itemsByThread?: Record<string, ConversationItem[] | undefined>;
}): {
  statusById: Record<string, ThreadProcessingHint>;
  itemsByThread: Record<string, ConversationItem[] | undefined>;
} {
  const probe = getSubagentSessionProbeSnapshot();
  const mergedItems: Record<string, ConversationItem[] | undefined> = {
    ...(options?.itemsByThread ?? {}),
  };
  const mergedStatus: Record<string, ThreadProcessingHint> = {};

  Object.entries(options?.statusById ?? {}).forEach(([id, hint]) => {
    if (hint) {
      mergedStatus[id] = { ...hint };
    }
  });

  Object.entries(probe.itemsByThread).forEach(([id, probeItems]) => {
    const existing = mergedItems[id];
    const existingHasAssistant =
      Array.isArray(existing) && itemHasAssistantText(existing);
    if (!existing || existing.length === 0 || !existingHasAssistant) {
      if (probeItems.length > 0) {
        mergedItems[id] = probeItems;
      }
    }
  });

  Object.entries(probe.statusById).forEach(([id, hint]) => {
    const current = mergedStatus[id];
    // canvas 明确仍在 processing 时不覆盖（避免历史 probe 误终态）
    if (current?.isProcessing === true && hint.isProcessing === false) {
      // 若 items 已有 assistant 终态，仍以终态为准
      const items = mergedItems[id] ?? [];
      if (itemHasAssistantText(items) || itemLooksFailed(items)) {
        mergedStatus[id] = { ...current, isProcessing: false };
      }
      return;
    }
    if (!current) {
      mergedStatus[id] = { ...hint };
      return;
    }
    if (hint.isProcessing === false) {
      mergedStatus[id] = { ...current, isProcessing: false };
    }
  });

  return { statusById: mergedStatus, itemsByThread: mergedItems };
}
