import type { ConversationItem } from "../../../types";
import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { normalizeSharedSessionEngine } from "../../shared-session/utils/sharedSessionEngines";
import {
  isSharedProjectionDataSourceEnabled,
  resolveSharedConversationItems,
} from "../../messages/presentation/sharedProjection/dataSource";
import type { SharedProjectionItem } from "../../messages/presentation/sharedProjection/types";

type SharedHistoryLoaderOptions = {
  workspaceId: string;
  loadSharedSession: (
    workspaceId: string,
    threadId: string,
  ) => Promise<Record<string, unknown> | null>;
  loadSharedProjection: (
    workspaceId: string,
    threadId: string,
  ) => Promise<SharedProjectionItem[]>;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function createSharedHistoryLoader({
  workspaceId,
  loadSharedSession,
  loadSharedProjection,
}: SharedHistoryLoaderOptions): HistoryLoader {
  return {
    engine: "codex",
    async load(threadId: string) {
      const response = await loadSharedSession(workspaceId, threadId);
      const legacyItems = Array.isArray(response?.items)
        ? (response?.items as ConversationItem[])
        : [];
      let items = legacyItems;
      if (isSharedProjectionDataSourceEnabled()) {
        try {
          items =
            resolveSharedConversationItems(
              await loadSharedProjection(workspaceId, threadId),
            ) ?? legacyItems;
        } catch (error) {
          console.warn(
            `[shared-projection] load failed; using V0 snapshot for ${threadId}`,
            error,
          );
        }
      }
      const selectedEngine = asString(response?.selectedEngine).trim().toLowerCase();
      const normalizedSelectedEngine = normalizeSharedSessionEngine(
        selectedEngine === "codex" || selectedEngine === "claude"
          ? selectedEngine
          : undefined,
      );
      return normalizeHistorySnapshot({
        engine: normalizedSelectedEngine,
        workspaceId,
        threadId,
        items,
        meta: {
          workspaceId,
          threadId,
          engine: normalizedSelectedEngine,
          activeTurnId: null,
          isThinking: false,
          heartbeatPulse: null,
          historyRestoredAtMs: Date.now(),
        },
      });
    },
  };
}
