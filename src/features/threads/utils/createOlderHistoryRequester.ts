import type { ConversationItem } from "../../../types";
import { CLAUDE_UI_HISTORY_WINDOW } from "../loaders/claudeHistoryLoader";
import {
  hasPendingOlderHistory,
  takeNextOlderHistoryBatch,
} from "./pendingOlderHistory";
import { notifyOlderHistoryBeforePrepend } from "./olderHistoryScrollRestoreBridge";
import {
  loadClaudeOlderHistoryPage,
  type LoadClaudeOlderHistoryPageResult,
} from "./loadClaudeOlderHistoryPage";

export type OlderHistoryWindowState = {
  hasMore: boolean;
  nextCursor: string | null;
};

export type OlderHistoryInFlight = {
  cursor: string;
  epoch: number;
};

export type OlderHistoryWorkspaceContext = {
  workspaceId: string;
  workspacePath: string;
};

export type OlderHistoryRequesterAction =
  | {
      type: "prependThreadItems";
      threadId: string;
      items: ConversationItem[];
    }
  | {
      type: "setThreadHistoryWindow";
      threadId: string;
      hasMore: boolean;
      nextCursor: string | null;
    };

export type OlderHistoryRequesterDeps = {
  dispatch: (action: OlderHistoryRequesterAction) => void;
  getHistoryWindow: (threadId: string) => OlderHistoryWindowState | undefined;
  resolveWorkspace: (threadId: string) => OlderHistoryWorkspaceContext | null;
  getDiskPageEpoch: (threadId: string) => number;
  inFlightByThread: Map<string, OlderHistoryInFlight>;
  loadPage?: (
    input: Parameters<typeof loadClaudeOlderHistoryPage>[0],
  ) => Promise<LoadClaudeOlderHistoryPageResult>;
  notifyBeforePrepend?: (threadId: string) => void;
};

function isConsumableDiskCursor(cursor: string | null | undefined): cursor is string {
  const trimmed = cursor?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== "memory";
}

function resolveWindowAfterMemoryDrain(
  threadId: string,
  getHistoryWindow: OlderHistoryRequesterDeps["getHistoryWindow"],
): OlderHistoryWindowState {
  if (hasPendingOlderHistory(threadId)) {
    return { hasMore: true, nextCursor: "memory" };
  }
  const diskWindow = getHistoryWindow(threadId);
  if (diskWindow?.hasMore === true && isConsumableDiskCursor(diskWindow.nextCursor)) {
    return {
      hasMore: true,
      nextCursor: diskWindow.nextCursor,
    };
  }
  return {
    hasMore: diskWindow?.hasMore === true,
    nextCursor: diskWindow?.nextCursor ?? null,
  };
}

export function createOlderHistoryRequester(
  deps: OlderHistoryRequesterDeps,
): (threadId: string) => boolean {
  const loadPage = deps.loadPage ?? loadClaudeOlderHistoryPage;
  const notifyBeforePrepend =
    deps.notifyBeforePrepend ?? notifyOlderHistoryBeforePrepend;

  return (threadId: string): boolean => {
    if (!threadId) {
      return false;
    }

    const memoryBatch = takeNextOlderHistoryBatch(threadId);
    if (memoryBatch.length > 0) {
      notifyBeforePrepend(threadId);
      deps.dispatch({
        type: "prependThreadItems",
        threadId,
        items: memoryBatch,
      });
      const nextWindow = resolveWindowAfterMemoryDrain(
        threadId,
        deps.getHistoryWindow,
      );
      deps.dispatch({
        type: "setThreadHistoryWindow",
        threadId,
        hasMore: nextWindow.hasMore,
        nextCursor: nextWindow.nextCursor,
      });
      return true;
    }

    if (deps.inFlightByThread.has(threadId)) {
      return false;
    }

    if (!threadId.startsWith("claude:")) {
      return false;
    }

    const window = deps.getHistoryWindow(threadId);
    if (window?.hasMore !== true || !isConsumableDiskCursor(window.nextCursor)) {
      return false;
    }

    const workspace = deps.resolveWorkspace(threadId);
    if (!workspace?.workspacePath) {
      return false;
    }

    const cursor = window.nextCursor;
    const epoch = deps.getDiskPageEpoch(threadId);
    deps.inFlightByThread.set(threadId, { cursor, epoch });

    void (async () => {
      try {
        const page = await loadPage({
          threadId,
          workspaceId: workspace.workspaceId,
          workspacePath: workspace.workspacePath,
          before: cursor,
          limit: CLAUDE_UI_HISTORY_WINDOW,
        });
        if (deps.getDiskPageEpoch(threadId) !== epoch) {
          return;
        }
        const flight = deps.inFlightByThread.get(threadId);
        if (!flight || flight.epoch !== epoch || flight.cursor !== cursor) {
          return;
        }
        notifyBeforePrepend(threadId);
        if (page.items.length > 0) {
          deps.dispatch({
            type: "prependThreadItems",
            threadId,
            items: page.items,
          });
        }
        deps.dispatch({
          type: "setThreadHistoryWindow",
          threadId,
          hasMore: page.hasMore === true,
          nextCursor: page.nextCursor ?? null,
        });
      } catch {
        // Keep hasMore / cursor so the chip stays and the same page can retry.
      } finally {
        const flight = deps.inFlightByThread.get(threadId);
        if (flight?.epoch === epoch && flight.cursor === cursor) {
          deps.inFlightByThread.delete(threadId);
        }
      }
    })();

    return true;
  };
}
