import type { ConversationItem } from "../../../types";
import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { normalizeSharedSessionEngine } from "../../shared-session/utils/sharedSessionEngines";
import {
  isSharedProjectionDataSourceEnabled,
  resolveSharedConversationItems,
} from "../../messages/presentation/sharedProjection/dataSource";
import type { SharedProjectionItem } from "../../messages/presentation/sharedProjection/types";
import { hydrateSharedTargetState } from "../../shared-session/target/targetStore";
import {
  isResolvedExecutionTarget,
  normalizePersistedExecutionTarget,
} from "../../shared-session/target/types";
import { mergeHistoryProjectionItems } from "../assembly/conversationAssembler";

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
      const persistedTarget = normalizePersistedExecutionTarget(
        response?.selectedTarget,
      );
      const resolvedPersistedTarget = isResolvedExecutionTarget(persistedTarget)
        ? persistedTarget
        : null;
      hydrateSharedTargetState(
        workspaceId,
        threadId,
        resolvedPersistedTarget,
      );
      const selectedEngine = asString(response?.selectedEngine).trim().toLowerCase();
      const normalizedSelectedEngine =
        resolvedPersistedTarget?.engine ??
        normalizeSharedSessionEngine(
          selectedEngine === "codex" || selectedEngine === "claude"
            ? selectedEngine
            : undefined,
        );
      const legacyItems = Array.isArray(response?.items)
        ? (response?.items as ConversationItem[])
        : [];
      let items = legacyItems;
      if (isSharedProjectionDataSourceEnabled()) {
        try {
          const projectedItems =
            resolveSharedConversationItems(
              await loadSharedProjection(workspaceId, threadId),
            ) ?? [];
          items =
            legacyItems.length > 0
              ? mergeHistoryProjectionItems(legacyItems, projectedItems, {
                  workspaceId,
                  threadId,
                  engine: normalizedSelectedEngine,
                })
              : projectedItems;
        } catch (error) {
          console.warn(
            legacyItems.length > 0
              ? `[shared-projection] load failed; using V0 snapshot for ${threadId}`
              : `[shared-projection] load failed; no V0 snapshot available for ${threadId}`,
            error,
          );
          if (legacyItems.length === 0) {
            throw error;
          }
        }
      }
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
