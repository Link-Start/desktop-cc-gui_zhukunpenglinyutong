import type { ConversationItem } from "../types";

/** turnId 只挂在部分 ConversationItem 变体上，统一安全读取。 */
export function turnIdOf(item: ConversationItem | undefined): string | null {
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
 * 本函数同时服务 DOM 800 窗与内存首屏 300 窗，禁止在调用方复制 while 回退。
 * 首屏可传 `maxDisplayed`：普通 turn 仍回退到段首，超大 turn 不得把整份
 * transcript 打进第一次 store 写入。`activeTurnId` 钉住仍可超过该顶。
 *
 * @returns 收起条数；0 = 不裁。
 */
export function resolveHistoryWindowCutIndex({
  items,
  windowSize,
  revealedItemCount,
  activeTurnId,
  maxDisplayed,
}: {
  items: readonly ConversationItem[];
  windowSize: number;
  revealedItemCount: number;
  activeTurnId: string | null;
  maxDisplayed?: number;
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
  const retreatFloor =
    maxDisplayed !== undefined && maxDisplayed > 0
      ? Math.max(0, items.length - maxDisplayed)
      : 0;
  // 不把同一 turn 切成两半：切口回退到该 turn 段首（段内全保留）。
  // 首屏硬顶：回退不得越过 retreatFloor；直播 activeTurn 钉住可低于该线。
  while (cut > retreatFloor) {
    const turnId = turnIdOf(items[cut]);
    if (turnId && turnIdOf(items[cut - 1]) === turnId) {
      cut -= 1;
    } else {
      break;
    }
  }
  return cut;
}
