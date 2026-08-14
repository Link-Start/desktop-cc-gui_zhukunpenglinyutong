// 流式 reasoning / toolOutput 电报外部化通道（perf flag: liveDeltaExternalization）。
//
// 背景：A4 一期只给「AI 正文」修了专线（liveAssistantTextChannel）；思考过程
// （reasoningContent / reasoningSummary）与工具输出（toolOutput）三类 delta 仍
// 每 32ms 攒一批 dispatch 进根 reducer，长思考回合里以 ~30 次/秒的频率打醒
// AppShell 大子树。本通道照 A4 正文专线的模子加 lane 维度泛化：首条 delta 建壳、
// 后续 delta 只更新此处并按 cadence 通知订阅行、settle 时 drain 尾部一次性落回
// reducer。
//
// 设计要点（与 liveAssistantTextChannel 一一对应）：
// - 按 threadId 建模，线程内以 `${itemId}:${lane}` 区分条目；三类 lane 互不串。
// - 纯内存、无持久化；「这行是否消费通道文本」由渲染层 isStreaming/isLive 判定，
//   reducer 对 reasoning item id 的 -seg-N 改写由消费侧匹配器容忍。
// - 首条 delta 全量记录（text 从首段起累计），渲染侧直接用条目全文，无需与壳
//   文本拼接；drain 只返回「尚未落 reducer 的尾段」（全长减建壳首段）。
// 方案文档：docs/perf/a4-live-text-externalization-plan.md（§2.3 预留的二期）

export type LiveItemDeltaLane =
  | "reasoningContent"
  | "reasoningSummary"
  | "toolOutput";

export type LiveItemDeltaEntry = {
  itemId: string;
  lane: LiveItemDeltaLane;
  text: string;
  version: number;
  /** 首条 delta（已随建壳 dispatch 落入 reducer）的长度，供 settle 时 drain 尾段。 */
  shellTextLength: number;
};

export const LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS = 48;

function laneKey(itemId: string, lane: LiveItemDeltaLane): string {
  return `${itemId}:${lane}`;
}

/** 每条 delta 的权威内存累积值；settle drain 必须从这里读取。 */
const entriesByThread = new Map<string, Map<string, LiveItemDeltaEntry>>();
/** React 可观察快照；仅允许在 notify 前换引用（useSyncExternalStore 要求稳定）。 */
const publishedEntriesByThread = new Map<string, ReadonlyMap<string, string>>();
const listenersByThread = new Map<string, Set<() => void>>();
const publishTimersByThread = new Map<string, ReturnType<typeof setTimeout>>();
const lastPublishedAtByThread = new Map<string, number>();

/** 空快照共享引用：无条目线程的 getSnapshot 必须返回同一引用。 */
const EMPTY_PUBLISHED_SNAPSHOT: ReadonlyMap<string, string> = new Map();

function notifyThread(threadId: string): void {
  const listeners = listenersByThread.get(threadId);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[liveItemDeltaChannel] listener failed", error);
    }
  }
}

function cancelPendingPublish(threadId: string): void {
  const timer = publishTimersByThread.get(threadId);
  if (timer !== undefined) {
    clearTimeout(timer);
    publishTimersByThread.delete(threadId);
  }
}

function publishThreadEntries(threadId: string): void {
  cancelPendingPublish(threadId);
  const entries = entriesByThread.get(threadId);
  const nextPublished = new Map<string, string>();
  if (entries) {
    for (const [key, entry] of entries) {
      nextPublished.set(key, entry.text);
    }
  }
  publishedEntriesByThread.set(threadId, nextPublished);
  lastPublishedAtByThread.set(threadId, Date.now());
  notifyThread(threadId);
}

function scheduleThreadPublish(threadId: string): void {
  const lastPublishedAt = lastPublishedAtByThread.get(threadId);
  const elapsed = lastPublishedAt === undefined
    ? LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS
    : Date.now() - lastPublishedAt;
  if (elapsed >= LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS) {
    publishThreadEntries(threadId);
    return;
  }
  if (publishTimersByThread.has(threadId)) {
    return;
  }
  publishTimersByThread.set(
    threadId,
    setTimeout(() => {
      publishTimersByThread.delete(threadId);
      publishThreadEntries(threadId);
    }, LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS - elapsed),
  );
}

/**
 * 累计一条 reasoning/toolOutput delta。
 * - 该 `${itemId}:${lane}` 无条目（新回合/新 item/新 lane）→ 建条目并返回
 *   isFirst=true，调用方应照旧 dispatch 该条 delta 以便 reducer 建壳。
 * - 否则无损追加文本并按 publish cadence 通知订阅者，返回 isFirst=false，
 *   调用方跳过 dispatch。
 */
export function appendLiveItemDelta(
  threadId: string,
  itemId: string,
  lane: LiveItemDeltaLane,
  delta: string,
): { isFirst: boolean } {
  let entries = entriesByThread.get(threadId);
  if (!entries) {
    entries = new Map();
    entriesByThread.set(threadId, entries);
  }
  const key = laneKey(itemId, lane);
  const existing = entries.get(key);
  if (!existing) {
    entries.set(key, {
      itemId,
      lane,
      text: delta,
      version: 1,
      shellTextLength: delta.length,
    });
    publishThreadEntries(threadId);
    return { isFirst: true };
  }
  entries.set(key, {
    ...existing,
    text: existing.text + delta,
    version: existing.version + 1,
  });
  scheduleThreadPublish(threadId);
  return { isFirst: false };
}

/**
 * 读权威累积文本（未节流的 entries），不是 48ms publish 后的 published 快照。
 * settle / drain 判定时必须用这个，否则会漏掉尚未 publish 的尾段。
 */
export function peekLiveItemDelta(
  threadId: string,
  itemId: string,
  lane: LiveItemDeltaLane,
): string {
  return entriesByThread.get(threadId)?.get(laneKey(itemId, lane))?.text ?? "";
}

/**
 * 读权威累积条目（含 shellTextLength 等元数据）；无条目返回 null。
 */
export function peekLiveItemDeltaEntry(
  threadId: string,
  itemId: string,
  lane: LiveItemDeltaLane,
): LiveItemDeltaEntry | null {
  return entriesByThread.get(threadId)?.get(laneKey(itemId, lane)) ?? null;
}

/**
 * settle / 中断时取走「尚未落入 reducer 的尾段」并清除该线程全部条目。
 * 返回数组中每项的 text 仅为尾段（全长减建壳首段），调用方应把它作为一条
 * 普通 delta dispatch 回落 durable items；只有建壳首段、无尾段的条目不出现
 * 在结果里。条目清除后订阅行切回读 durable 文本。
 */
export function drainLiveItemDeltaTail(
  threadId: string,
): Array<{ itemId: string; lane: LiveItemDeltaLane; text: string }> {
  const entries = entriesByThread.get(threadId);
  if (!entries || entries.size === 0) {
    return [];
  }
  cancelPendingPublish(threadId);
  entriesByThread.delete(threadId);
  lastPublishedAtByThread.delete(threadId);
  const drained: Array<{ itemId: string; lane: LiveItemDeltaLane; text: string }> = [];
  for (const entry of entries.values()) {
    if (entry.text.length > entry.shellTextLength) {
      drained.push({
        itemId: entry.itemId,
        lane: entry.lane,
        text: entry.text.slice(entry.shellTextLength),
      });
    }
  }
  if (publishedEntriesByThread.delete(threadId)) {
    notifyThread(threadId);
  }
  return drained;
}

/** 回合结束/线程删除时清除条目（订阅行随之切回读 durable 文本）。 */
export function clearLiveItemDelta(threadId: string): void {
  cancelPendingPublish(threadId);
  entriesByThread.delete(threadId);
  lastPublishedAtByThread.delete(threadId);
  if (publishedEntriesByThread.delete(threadId)) {
    notifyThread(threadId);
  }
}

/**
 * 清除某 item 的全部 lane 条目（item 级完成快照是权威文本时调用）。
 * 不清其它 item 的条目；返回是否有条目被清除。
 */
export function clearLiveItemDeltaForItem(
  threadId: string,
  itemId: string,
): boolean {
  const entries = entriesByThread.get(threadId);
  if (!entries) {
    return false;
  }
  let removed = false;
  for (const lane of ["reasoningContent", "reasoningSummary", "toolOutput"] as const) {
    removed = entries.delete(laneKey(itemId, lane)) || removed;
  }
  if (entries.size === 0) {
    entriesByThread.delete(threadId);
  }
  if (removed) {
    // 立即重发布，订阅行在同一帧内切回 durable 文本，避免残留旧快照。
    publishThreadEntries(threadId);
  }
  return removed;
}

/**
 * React 可观察快照：key = `${itemId}:${lane}`，value = 已发布全文。
 * 无条目线程返回共享空 Map（引用稳定）。
 */
export function getLiveItemDeltaSnapshot(
  threadId: string,
): ReadonlyMap<string, string> {
  return publishedEntriesByThread.get(threadId) ?? EMPTY_PUBLISHED_SNAPSHOT;
}

export function subscribeLiveItemDelta(
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

export function resetLiveItemDeltaChannelForTests(): void {
  for (const timer of publishTimersByThread.values()) {
    clearTimeout(timer);
  }
  publishTimersByThread.clear();
  entriesByThread.clear();
  publishedEntriesByThread.clear();
  lastPublishedAtByThread.clear();
  listenersByThread.clear();
}
