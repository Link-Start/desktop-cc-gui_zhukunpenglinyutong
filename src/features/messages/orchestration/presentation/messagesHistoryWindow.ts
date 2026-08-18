import type { ConversationItem } from "../../../../types";

/**
 * 历史分页窗口（03 号清单）：会话进行中 DOM 只保留最近一段窗口，
 * 超窗的最老一段收进「上方还有 N 条」chip，点击按页加载更早。
 *
 * 只裁表现层（renderedItems），数据层 reducer items 始终全量：
 * DOM 成本由渲染窗口决定，数据不丢、hydration/replay 不碰。
 *
 * flag：ccgui.perf.historyWindowSize
 * - 生产默认 800。Task 1 定标（Messages.history-window.test.tsx，真实 Markdown、
 *   正文+工具输出+diff+代码块混合）：单条均值 ≈ 20~26 个 DOM 节点；
 *   800 条窗口 ≈ 16k~21k 节点；500 条全量 ≈ 13k 节点且线性增长。
 * - 测试默认 0（关闭=全量），保持既有用例确定；显式 setItem 开启
 * - 值 <=0 或非法 = 关闭（恢复全量）
 */
export const HISTORY_WINDOW_SIZE_FLAG_KEY = "ccgui.perf.historyWindowSize";
export const DEFAULT_HISTORY_WINDOW_SIZE = 800;
export const NEAR_TOP_OLDER_HISTORY_THRESHOLD_PX = 32;

export function resolveEarlierHistoryChip(input: {
  knownCollapsedCount: number;
  diskHistoryHasMore: boolean;
}): {
  visible: boolean;
  hasUncountedEarlierHistory: boolean;
  countedCount: number;
} {
  const countedCount = Math.max(0, input.knownCollapsedCount);
  const hasUncountedEarlierHistory =
    input.diskHistoryHasMore && countedCount === 0;
  return {
    visible: countedCount > 0 || input.diskHistoryHasMore,
    hasUncountedEarlierHistory,
    countedCount,
  };
}

export function shouldRequestOlderHistoryNearTop(scrollTop: number): boolean {
  return (
    Number.isFinite(scrollTop) &&
    scrollTop < NEAR_TOP_OLDER_HISTORY_THRESHOLD_PX
  );
}
const TEST_DEFAULT_HISTORY_WINDOW_SIZE = 0;

const isTestMode = (() => {
  try {
    return import.meta.env.MODE === "test";
  } catch {
    return false;
  }
})();

let cachedWindowSize: number | null = null;

function parseWindowSize(raw: string | null): number | null {
  if (raw == null) {
    return null;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/** 读取历史窗口大小（条）。<=0 表示关闭裁剪（全量渲染）。 */
export function readHistoryWindowSize(): number {
  const fallback = isTestMode
    ? TEST_DEFAULT_HISTORY_WINDOW_SIZE
    : DEFAULT_HISTORY_WINDOW_SIZE;
  if (!isTestMode && cachedWindowSize !== null) {
    return cachedWindowSize;
  }
  let resolved = fallback;
  if (typeof window !== "undefined") {
    try {
      const parsed = parseWindowSize(
        window.localStorage.getItem(HISTORY_WINDOW_SIZE_FLAG_KEY),
      );
      if (parsed !== null) {
        resolved = parsed;
      }
    } catch {
      // storage 读取失败时保持默认值
    }
  }
  if (!isTestMode) {
    cachedWindowSize = resolved;
  }
  return resolved;
}

export function __resetHistoryWindowSizeCacheForTests() {
  cachedWindowSize = null;
}

/** turnId 只挂在部分 ConversationItem 变体上，统一安全读取。 */
function turnIdOf(item: ConversationItem | undefined): string | null {
  if (!item || !("turnId" in item)) {
    return null;
  }
  const turnId = (item as { turnId?: unknown }).turnId;
  return typeof turnId === "string" && turnId ? turnId : null;
}

/**
 * 计算历史窗口的裁剪下标（= 收起条数，slice 起点）。
 *
 * pinned 例外（不许裁）：
 * - 当前进行中的 turn（activeTurnId）：切口回退到该 turn 首条；
 * - 任意 turn 不切两半：切口落在同 turnId 段中间时回退到段首（宁可窗口略大）。
 * live 行 / 待审批行天然在最新尾部窗口内；审批行由独立 store 渲染，不经 items。
 *
 * @returns 收起条数；0 = 不裁。
 */
export function resolveHistoryWindowCutIndex({
  items,
  windowSize,
  revealedItemCount,
  activeTurnId,
}: {
  items: readonly ConversationItem[];
  windowSize: number;
  revealedItemCount: number;
  activeTurnId: string | null;
}): number {
  if (windowSize <= 0) {
    return 0;
  }
  const visibleBudget = windowSize + Math.max(0, revealedItemCount);
  if (items.length <= visibleBudget) {
    return 0;
  }
  let cut = items.length - visibleBudget;
  if (activeTurnId) {
    const firstActiveTurnIndex = items.findIndex(
      (item) => turnIdOf(item) === activeTurnId,
    );
    if (firstActiveTurnIndex >= 0 && firstActiveTurnIndex < cut) {
      cut = firstActiveTurnIndex;
    }
  }
  // 不把同一 turn 切成两半：切口回退到该 turn 段首（段内全保留）。
  while (cut > 0) {
    const turnId = turnIdOf(items[cut]);
    if (turnId && turnIdOf(items[cut - 1]) === turnId) {
      cut -= 1;
    } else {
      break;
    }
  }
  return cut;
}
