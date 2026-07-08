// 流式正文 live-text 外部化通道（perf flag: liveTextExternalization）。
//
// 背景：流式期间每条正文 delta 若都 dispatch 进根 reducer，就会以每秒多次的
// 频率换 itemsByThread 引用并触发 AppShell（根组件）全树重渲染，单次端到端
// 100ms+。本通道让「首条 delta 建壳、后续 delta 只更新此处并通知订阅的
// MessageRow 小树、回合结束终稿一次性落 reducer」，把每回合根渲染压到 2 次。
//
// 设计要点：
// - 按 threadId 建模（每线程同时只有一个活跃流式正文）；「这行是否消费通道
//   文本」交给渲染层既有的 isStreaming 判定，从而绕开 reducer 对 item id 的
//   canonicalize/分段改写与事件层 itemId 不一致的问题。
// - 纯内存、无持久化。断流恢复由 liveAssistantShadowTranscript（独立写入）
//   兜底，本通道不参与恢复。
// - 首条 delta 全量记录（text 从首段起累计），渲染侧可直接用 entry.text，
//   无需与壳文本拼接。
// 方案文档：docs/perf/a4-live-text-externalization-plan.md

export type LiveAssistantTextEntry = {
  itemId: string;
  text: string;
  version: number;
  /** 首条 delta（已随建壳 dispatch 落入 reducer）的长度，供中断时 drain 尾段。 */
  shellTextLength: number;
};

const entriesByThread = new Map<string, LiveAssistantTextEntry>();
const listenersByThread = new Map<string, Set<() => void>>();

function notifyThread(threadId: string): void {
  const listeners = listenersByThread.get(threadId);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[liveAssistantTextChannel] listener failed", error);
    }
  }
}

/**
 * 累计一条正文 delta。
 * - 线程无条目或 itemId 变化（新回合/分段切换/别名 id）→ 重置条目并返回
 *   isFirst=true，调用方应照旧 dispatch 该条 delta 以便 reducer 建壳。
 * - 否则追加文本并通知订阅者，返回 isFirst=false，调用方跳过 dispatch。
 */
export function appendLiveAssistantText(
  threadId: string,
  itemId: string,
  delta: string,
): { isFirst: boolean } {
  const existing = entriesByThread.get(threadId);
  if (!existing || existing.itemId !== itemId) {
    entriesByThread.set(threadId, {
      itemId,
      text: delta,
      version: 1,
      shellTextLength: delta.length,
    });
    notifyThread(threadId);
    return { isFirst: true };
  }
  entriesByThread.set(threadId, {
    itemId: existing.itemId,
    text: existing.text + delta,
    version: existing.version + 1,
    shellTextLength: existing.shellTextLength,
  });
  notifyThread(threadId);
  return { isFirst: false };
}

/** 回合结束/线程删除时清除条目（订阅行随之切回读 item.text）。 */
export function clearLiveAssistantText(threadId: string): void {
  if (entriesByThread.delete(threadId)) {
    notifyThread(threadId);
  }
}

/**
 * 中断时取走「尚未落入 reducer 的尾段」并清除条目。
 * 调用方应把 tailDelta 作为一条普通 delta dispatch，让被中断的部分正文
 * 落进 items（否则中断后该行会回退到壳首段）。
 */
export function drainLiveAssistantTextTail(
  threadId: string,
): { itemId: string; tailDelta: string } | null {
  const entry = entriesByThread.get(threadId);
  if (!entry) {
    return null;
  }
  entriesByThread.delete(threadId);
  notifyThread(threadId);
  if (entry.text.length <= entry.shellTextLength) {
    return null;
  }
  return {
    itemId: entry.itemId,
    tailDelta: entry.text.slice(entry.shellTextLength),
  };
}

/** 会话 id 迁移（pending → canonical）时随迁条目。 */
export function renameLiveAssistantTextThread(
  oldThreadId: string,
  newThreadId: string,
): void {
  if (oldThreadId === newThreadId) {
    return;
  }
  const entry = entriesByThread.get(oldThreadId);
  if (!entry) {
    return;
  }
  entriesByThread.delete(oldThreadId);
  entriesByThread.set(newThreadId, entry);
  notifyThread(oldThreadId);
  notifyThread(newThreadId);
}

export function getLiveAssistantTextSnapshot(
  threadId: string,
): LiveAssistantTextEntry | null {
  return entriesByThread.get(threadId) ?? null;
}

export function subscribeLiveAssistantText(
  threadId: string,
  listener: () => void,
): () => void {
  let listeners = listenersByThread.get(threadId);
  if (!listeners) {
    listeners = new Set();
    listenersByThread.set(threadId, listeners);
  }
  listeners.add(listener);
  return () => {
    const current = listenersByThread.get(threadId);
    if (!current) {
      return;
    }
    current.delete(listener);
    if (current.size === 0) {
      listenersByThread.delete(threadId);
    }
  };
}

export function resetLiveAssistantTextChannelForTests(): void {
  entriesByThread.clear();
  listenersByThread.clear();
}
