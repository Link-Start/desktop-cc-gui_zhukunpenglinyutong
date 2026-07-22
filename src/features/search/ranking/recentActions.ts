import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../../services/clientStorage";

const RECENT_ACTIONS_KEY = "search.recentActions";
export const RECENT_ACTION_LIMIT = 20;

export type RecentSearchAction = {
  actionId: string;
  executedAt: number;
};

function isRecentSearchAction(value: unknown): value is RecentSearchAction {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RecentSearchAction>;
  return typeof candidate.actionId === "string"
    && candidate.actionId.trim().length > 0
    && typeof candidate.executedAt === "number"
    && Number.isFinite(candidate.executedAt);
}

export function normalizeRecentSearchActions(value: unknown): RecentSearchAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecentSearchAction)
    .map((entry) => ({ ...entry, actionId: entry.actionId.trim() }))
    .sort((left, right) => right.executedAt - left.executedAt)
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.actionId === entry.actionId) === index,
    )
    .slice(0, RECENT_ACTION_LIMIT);
}

export function loadRecentSearchActions(): RecentSearchAction[] {
  return normalizeRecentSearchActions(
    getClientStoreSync<unknown>("app", RECENT_ACTIONS_KEY),
  );
}

export function recordRecentSearchAction(
  actionId: string,
  executedAt = Date.now(),
): void {
  const normalizedActionId = actionId.trim();
  if (!normalizedActionId || !Number.isFinite(executedAt)) {
    return;
  }
  const next = normalizeRecentSearchActions([
    { actionId: normalizedActionId, executedAt },
    ...loadRecentSearchActions(),
  ]);
  writeClientStoreValue("app", RECENT_ACTIONS_KEY, next);
}
