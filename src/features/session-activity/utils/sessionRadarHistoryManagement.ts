import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import {
  RADAR_STORE_NAME,
  SESSION_RADAR_READ_STATE_KEY,
  SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
  SESSION_RADAR_HISTORY_UPDATED_EVENT,
  SESSION_RADAR_RECENT_STORAGE_KEY,
  applyRadarRecentBounds,
  parsePersistedRadarRecentEntry,
  readDismissedCompletedAtById,
} from "./sessionRadarPersistence";

export type SessionRadarHistoryDeleteFailure = {
  id: string;
  code: "INVALID_ID" | "NOT_FOUND";
  message: string;
};

export type SessionRadarHistoryDeleteTarget = {
  id: string;
  completedAt: number;
  // 调用方展示的 entry.updatedAt（merge 时已用 live thread / lastAgent 刷新）。
  // 删除 cutoff 必须覆盖它，否则 updatedAt 领先 completedAt 的 reconcile 条目会复活。
  liveUpdatedAt?: number;
};

export type SessionRadarHistoryDeleteResult = {
  succeededEntryIds: string[];
  failed: SessionRadarHistoryDeleteFailure[];
};

export function deleteSessionRadarHistoryEntries(
  targets: SessionRadarHistoryDeleteTarget[],
): SessionRadarHistoryDeleteResult {
  if (!Array.isArray(targets) || targets.length === 0) {
    return { succeededEntryIds: [], failed: [] };
  }

  const rawRecent = getClientStoreSync<unknown>(RADAR_STORE_NAME, SESSION_RADAR_RECENT_STORAGE_KEY);
  const persistedRecent = Array.isArray(rawRecent)
    ? rawRecent
        .map(parsePersistedRadarRecentEntry)
        .filter((entry): entry is NonNullable<ReturnType<typeof parsePersistedRadarRecentEntry>> =>
          Boolean(entry),
        )
    : [];

  const recentById = new Map(persistedRecent.map((entry) => [entry.id, entry]));
  const nextDismissedById = { ...readDismissedCompletedAtById() };
  const succeededEntryIds: string[] = [];
  const failed: SessionRadarHistoryDeleteFailure[] = [];

  for (const target of targets) {
    const normalizedId = typeof target?.id === "string" ? target.id.trim() : "";
    if (!normalizedId) {
      failed.push({
        id: "",
        code: "INVALID_ID",
        message: "Invalid radar history id",
      });
      continue;
    }
    const persisted = recentById.get(normalizedId);
    const targetCompletedAt = Number.isFinite(target.completedAt) ? target.completedAt : 0;
    const targetLiveUpdatedAt = Number.isFinite(target.liveUpdatedAt)
      ? (target.liveUpdatedAt as number)
      : 0;
    // cutoff 覆盖四方：persisted completedAt / persisted updatedAt（merge 已用 live
    // thread 刷新并回写）/ 调用方展示的 live updatedAt / 既有 cutoff。否则 reconcile
    // 以 thread.updatedAt 补写时会绕过只覆盖 completedAt 的 cutoff，删除条目复活。
    const cutoff = Math.max(
      persisted?.completedAt ?? 0,
      persisted?.updatedAt ?? 0,
      targetCompletedAt,
      targetLiveUpdatedAt,
      nextDismissedById[normalizedId] ?? 0,
    );
    if (cutoff <= 0) {
      failed.push({
        id: normalizedId,
        code: "NOT_FOUND",
        message: "Radar history entry not found",
      });
      continue;
    }

    recentById.delete(normalizedId);
    nextDismissedById[normalizedId] = cutoff;
    succeededEntryIds.push(normalizedId);
  }

  // 删除同样是惰性修剪的 merge 点：超限/过期的旧数据在此收敛；被 bounds 物理
  // 修剪条目的 dismissed 记录一并清除（本次用户删除的 cutoff 不在 prunedEntryIds
  // 内，不受影响）。此处的候选集只来自 persisted 快照（纯物理条目），不混入
  // reconcile 合成条目，不会误销用户 cutoff。
  const { entries: nextRecent, prunedEntryIds } = applyRadarRecentBounds(
    Array.from(recentById.values()).sort((a, b) => b.completedAt - a.completedAt),
  );
  if (prunedEntryIds.length > 0) {
    for (const prunedId of prunedEntryIds) {
      delete nextDismissedById[prunedId];
    }
  }
  const activeIds = new Set(nextRecent.map((entry) => entry.id));
  // 写盘顺序：先落 dismissed cutoff 再落 recent。若崩溃发生在两次写之间，
  // recent 中的残留条目会被已落盘的 cutoff 过滤（isRecentEntryDismissed），
  // reconcile 也不会补写；反向顺序则会留下「条目已删、cutoff 未写」的复活窗口。
  writeClientStoreValue(
    RADAR_STORE_NAME,
    SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
    nextDismissedById,
    { immediate: true },
  );
  const currentReadState =
    getClientStoreSync<Record<string, number>>(RADAR_STORE_NAME, SESSION_RADAR_READ_STATE_KEY) ?? {};
  const nextReadState = Object.fromEntries(
    Object.entries(currentReadState).filter(
      ([entryId]) => activeIds.has(entryId) && !succeededEntryIds.includes(entryId),
    ),
  );
  writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_READ_STATE_KEY, nextReadState, {
    immediate: true,
  });
  writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_RECENT_STORAGE_KEY, nextRecent, {
    immediate: true,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_RADAR_HISTORY_UPDATED_EVENT));
  }

  return {
    succeededEntryIds,
    failed,
  };
}
