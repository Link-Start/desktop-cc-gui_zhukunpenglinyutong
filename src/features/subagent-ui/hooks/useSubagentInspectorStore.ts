import { useSyncExternalStore } from "react";
import type { SubagentCardViewModel } from "../utils/subagentViewModel";

type Listener = () => void;

let selected: SubagentCardViewModel | null = null;
/** 上次绑定的会话 scope（module 级，跨 Messages remount 仍有效） */
let boundScopeKey: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openSubagentInspector(card: SubagentCardViewModel) {
  // 同一卡再次点击 → toggle 关闭
  if (selected?.id === card.id) {
    selected = null;
  } else {
    selected = card;
  }
  emit();
}

export function closeSubagentInspector() {
  if (selected === null) {
    return;
  }
  selected = null;
  emit();
}

/**
 * 小队 / 状态面板 re-enrich 后，把同 id 的最新 card 同步进 inspector，
 * 避免抽屉打开瞬间的 status 快照永久冻结在 running。
 */
export function syncSubagentInspectorSelection(
  latest: SubagentCardViewModel,
): void {
  if (!selected || selected.id !== latest.id) {
    return;
  }
  if (
    selected.status === latest.status &&
    selected.progress === latest.progress &&
    selected.outputText === latest.outputText &&
    selected.sessionThreadId === latest.sessionThreadId &&
    selected.description === latest.description &&
    selected.typeLabel === latest.typeLabel
  ) {
    return;
  }
  selected = {
    ...selected,
    ...latest,
    // 保留打开时可能已解析的 session，除非最新值更具体
    sessionThreadId: latest.sessionThreadId ?? selected.sessionThreadId,
    agentId: latest.agentId ?? selected.agentId,
    taskOutput: latest.taskOutput ?? selected.taskOutput,
    outputText: latest.outputText ?? selected.outputText,
  };
  emit();
}

/** 对当前选中卡批量尝试同步（传入 squad 全部 cards） */
export function syncSubagentInspectorFromCards(
  cards: readonly SubagentCardViewModel[],
): void {
  if (!selected) {
    return;
  }
  const match = cards.find((card) => card.id === selected?.id);
  if (match) {
    syncSubagentInspectorSelection(match);
  }
}

/**
 * 仅在 workspace/thread **真正切换**时关闭 inspector。
 * 禁止在 Messages 重挂载（同 scope）时关闭——否则打开 split 会闪一下立刻关。
 */
export function closeSubagentInspectorIfScopeChanged(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
) {
  const nextKey = `${workspaceId ?? ""}\u0000${threadId ?? ""}`;
  if (boundScopeKey === null) {
    boundScopeKey = nextKey;
    return;
  }
  if (boundScopeKey === nextKey) {
    return;
  }
  boundScopeKey = nextKey;
  closeSubagentInspector();
}

export function getSubagentInspectorSelection() {
  return selected;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSubagentInspectorSelection() {
  return useSyncExternalStore(subscribe, getSubagentInspectorSelection, () => null);
}
