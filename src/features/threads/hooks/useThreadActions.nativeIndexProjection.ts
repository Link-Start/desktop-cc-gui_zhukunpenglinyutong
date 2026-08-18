import type { ThreadSummary } from "../../../types";
import type { SessionIndexRow } from "../../../services/tauri";
import { sessionIndexRowsToThreadSummaries } from "./sessionIndexThreadSummaries";
import { unionIndexWithNewerLastGood } from "./useThreadActions.lastGoodSnapshots";
import { mergePreservedSharedThreadsForIndexFirstPaint } from "./sharedNativeVisibility";

/**
 * Native `listThreadsForWorkspace` projection extract.
 * Session Index is the sidebar read layer.
 * Hide unreadiness must not strip indexed natives: last-good hide if present,
 * otherwise full-show every Index row. Shared hide source is unchanged.
 */
export function selectNativeSessionIndexRows<T>(rows: readonly T[]): T[] {
  return [...rows];
}

export function shouldRememberHideUnreadiness(visibilityReady: boolean): boolean {
  return !visibilityReady;
}

export function projectNativeIndexRowsToSummaries(
  rows: readonly SessionIndexRow[],
  options: {
    workspaceId: string;
    mappedTitles: Record<string, string>;
    getCustomName: (workspaceId: string, threadId: string) => string | undefined;
    hiddenSharedBindingIds?: Set<string>;
  },
): ThreadSummary[] {
  return sessionIndexRowsToThreadSummaries(
    selectNativeSessionIndexRows(rows),
    options,
  );
}

export function buildNativeIndexEarlyPaintSummaries(params: {
  rows: readonly SessionIndexRow[];
  workspaceId: string;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  hideSet: Set<string>;
  currentThreads: ThreadSummary[] | undefined;
  lastGood: ThreadSummary[];
}): ThreadSummary[] {
  return unionIndexWithNewerLastGood(
    mergePreservedSharedThreadsForIndexFirstPaint(
      projectNativeIndexRowsToSummaries(params.rows, {
        workspaceId: params.workspaceId,
        mappedTitles: {},
        getCustomName: params.getCustomName,
        hiddenSharedBindingIds: params.hideSet,
      }),
      params.currentThreads,
      params.lastGood,
    ),
    [...(params.currentThreads ?? []), ...params.lastGood],
  );
}
