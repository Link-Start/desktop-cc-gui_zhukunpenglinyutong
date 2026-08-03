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
