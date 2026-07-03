// Composer 草稿的模块级外部 store。
//
// 草稿曾经是 app-shell 根组件的 useState(composerDraftsByThread):每次按键(防抖 100ms)
// 都 setState 在根上,导致整个 app-shell(含全部面板)重渲染一次(~200ms 输入卡顿主因)。
// 改为外部 store 后,写入不再触达根;只有真正订阅草稿值的组件(Composer 自身)重渲染。
//
// 键约定:threadId 为 null 表示"未绑定会话"的游离草稿(detached draft),与旧实现一致。

import { useSyncExternalStore } from "react";

type ComposerDraftState = {
  draftsByThread: Record<string, string>;
  detachedDraft: string;
};

const EMPTY_STATE: ComposerDraftState = {
  draftsByThread: {},
  detachedDraft: "",
};

let state: ComposerDraftState = EMPTY_STATE;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取指定会话(null = 游离)的当前草稿。命令式读取,供事件回调使用。 */
export function getComposerDraft(threadId: string | null): string {
  if (!threadId) {
    return state.detachedDraft;
  }
  return state.draftsByThread[threadId] ?? "";
}

/** 写入指定会话(null = 游离)的草稿。值未变化时不通知订阅者。 */
export function setComposerDraft(threadId: string | null, next: string): void {
  if (getComposerDraft(threadId) === next) {
    return;
  }
  if (!threadId) {
    state = { ...state, detachedDraft: next };
  } else {
    state = {
      ...state,
      draftsByThread: { ...state.draftsByThread, [threadId]: next },
    };
  }
  notify();
}

/** 清除指定会话的草稿(发送成功/删除会话后调用)。 */
export function clearComposerDraft(threadId: string): void {
  if (!(threadId in state.draftsByThread)) {
    return;
  }
  const { [threadId]: _removed, ...rest } = state.draftsByThread;
  state = { ...state, draftsByThread: rest };
  notify();
}

/** 订阅指定会话草稿值。快照是字符串本身,值不变时 useSyncExternalStore 不会重渲染。 */
export function useComposerDraft(threadId: string | null): string {
  return useSyncExternalStore(
    subscribe,
    () => getComposerDraft(threadId),
    () => getComposerDraft(threadId),
  );
}

export function __resetComposerDraftStoreForTests(): void {
  state = EMPTY_STATE;
  listeners.clear();
}
