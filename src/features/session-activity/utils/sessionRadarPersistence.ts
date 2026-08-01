import { getClientStoreSync } from "../../../services/clientStorage";

export const RADAR_STORE_NAME = "leida" as const;
export const SESSION_RADAR_RECENT_STORAGE_KEY = "sessionRadar.recentCompleted" as const;
export const SESSION_RADAR_READ_STATE_KEY = "sessionRadar.readStateById" as const;
export const SESSION_RADAR_COLLAPSED_DATE_GROUPS_KEY = "sessionRadar.collapsedDateGroups" as const;
export const SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY =
  "sessionRadar.dismissedCompletedAtById" as const;
export const SESSION_RADAR_HISTORY_UPDATED_EVENT = "session-radar-history-updated" as const;

// recentCompleted 惰性修剪边界：30 天 TTL（按 completedAt）、每 workspace 50 条、
// 全局 200 条。不设启动 migration，旧数据在任意 merge 时自然收敛。
export const RADAR_RECENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const RADAR_RECENT_WORKSPACE_LIMIT = 50;
export const RADAR_RECENT_GLOBAL_LIMIT = 200;

export type PersistedRadarRecentEntry = {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  threadId: string;
  threadName?: string;
  engine?: string;
  preview?: string;
  updatedAt?: number;
  startedAt: number | null;
  completedAt: number;
  durationMs: number | null;
};

export function buildRadarCompletionId(workspaceId: string, threadId: string) {
  return `${workspaceId}:${threadId}`;
}

// dismissed cutoff 与 recentCompleted 共用同一 TTL 惰性收敛：读取时丢弃
// cutoff 早于 now - RADAR_RECENT_TTL_MS 的陈旧记录（对应完成条目早已物理过期），
// 避免 dismissedCompletedAtById 随删除操作无界增长。无启动 migration，调用方在
// merge/删除写回时自然把过滤结果落盘。
export function readDismissedCompletedAtById(now = Date.now()): Record<string, number> {
  const raw = getClientStoreSync<unknown>(
    RADAR_STORE_NAME,
    SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
  );
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const ttlCutoff = now - RADAR_RECENT_TTL_MS;
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([entryId, value]) =>
      typeof entryId === "string" &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0 &&
      value >= ttlCutoff,
  );
  return Object.fromEntries(entries) as Record<string, number>;
}

export function resolveLatestUserMessage(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const candidate = items[index] as { kind?: unknown; role?: unknown; text?: unknown };
    if (candidate?.kind === "message" && candidate.role === "user") {
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (text) {
        return text;
      }
    }
  }
  return "";
}

export function parsePersistedRadarRecentEntry(raw: unknown): PersistedRadarRecentEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as Partial<PersistedRadarRecentEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.workspaceId !== "string" ||
    typeof entry.threadId !== "string" ||
    typeof entry.completedAt !== "number"
  ) {
    return null;
  }
  return {
    id: buildRadarCompletionId(entry.workspaceId, entry.threadId),
    workspaceId: entry.workspaceId,
    workspaceName: typeof entry.workspaceName === "string" ? entry.workspaceName : undefined,
    threadId: entry.threadId,
    threadName: typeof entry.threadName === "string" ? entry.threadName : undefined,
    engine: typeof entry.engine === "string" ? entry.engine : undefined,
    preview: typeof entry.preview === "string" ? entry.preview : undefined,
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : undefined,
    startedAt: typeof entry.startedAt === "number" ? entry.startedAt : null,
    completedAt: entry.completedAt,
    durationMs: typeof entry.durationMs === "number" ? Math.max(0, entry.durationMs) : null,
  };
}

export type RadarRecentBoundsResult<T> = {
  entries: T[];
  prunedEntryIds: string[];
};

// 输入无需预先排序；内部按 completedAt 降序保留最新条目，被 TTL / 双上限淘汰的
// 条目 id 通过 prunedEntryIds 返回，调用方据此同步清理 dismissedCompletedAtById。
export function applyRadarRecentBounds<
  T extends { id: string; workspaceId: string; completedAt: number | null },
>(entries: T[], now = Date.now()): RadarRecentBoundsResult<T> {
  const ttlCutoff = now - RADAR_RECENT_TTL_MS;
  const sorted = [...entries].sort(
    (left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0),
  );
  const kept: T[] = [];
  const prunedEntryIds: string[] = [];
  const keptCountByWorkspaceId = new Map<string, number>();
  for (const entry of sorted) {
    const workspaceKeptCount = keptCountByWorkspaceId.get(entry.workspaceId) ?? 0;
    const isExpired = (entry.completedAt ?? 0) < ttlCutoff;
    if (
      isExpired ||
      workspaceKeptCount >= RADAR_RECENT_WORKSPACE_LIMIT ||
      kept.length >= RADAR_RECENT_GLOBAL_LIMIT
    ) {
      prunedEntryIds.push(entry.id);
      continue;
    }
    keptCountByWorkspaceId.set(entry.workspaceId, workspaceKeptCount + 1);
    kept.push(entry);
  }
  return { entries: kept, prunedEntryIds };
}

export function mergePersistedRadarRecentEntries(
  rawPersistedRecent: unknown,
  completedEntries: PersistedRadarRecentEntry[],
  now = Date.now(),
): RadarRecentBoundsResult<PersistedRadarRecentEntry> {
  const persistedRecentList = Array.isArray(rawPersistedRecent)
    ? rawPersistedRecent
        .map(parsePersistedRadarRecentEntry)
        .filter((entry): entry is PersistedRadarRecentEntry => Boolean(entry))
    : [];

  const mergedById = new Map<string, PersistedRadarRecentEntry>();
  for (const entry of persistedRecentList) {
    mergedById.set(entry.id, entry);
  }
  for (const entry of completedEntries) {
    const previous = mergedById.get(entry.id);
    if (!previous || previous.completedAt <= entry.completedAt) {
      mergedById.set(entry.id, entry);
    }
  }
  const merged = Array.from(mergedById.values()).sort(
    (left, right) => right.completedAt - left.completedAt,
  );
  return applyRadarRecentBounds(merged, now);
}

export function dispatchSessionRadarHistoryUpdatedEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_RADAR_HISTORY_UPDATED_EVENT));
  }
}
