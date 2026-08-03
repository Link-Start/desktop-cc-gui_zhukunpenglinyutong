import { useDeferredValue, useMemo } from "react";
import type { ConversationItem, EngineType } from "../../../../types";
import { buildSuppressedUserMemoryContextMessageIdSet } from "../../utils/context/messagesMemoryContext";
import { buildSuppressedUserNoteCardContextMessageIdSet } from "../../utils/context/messagesNoteCardContext";
import { groupToolItems } from "../../utils/groupToolItems";
import {
  isAssistantMessageConversationItem,
  isReasoningConversationItem,
} from "../../utils/messageItemPredicates";
import {
  countRenderableCollapsedEntries,
  isClaudeHistoryTranscriptHeavy,
} from "../../utils/messagesRenderUtils";
import {
  buildTurnFileChangesByBoundaryId,
  mergeTurnFileChangesSummaries,
} from "../../utils/turnFileChanges";
import {
  buildAssistantFinalBoundarySet,
  buildMessagesPresentationScopeKey,
  resolveLiveAutoExpandedExploreId,
  resolveStreamingPresentationItems,
  type MessagesPresentationMode,
} from "../presentation/messagesLiveWindow";
import { buildTurnTargetBadgeVisibleItemIds } from "../../../../utils/turnBadge";
import { findItemById } from "../presentation/messagesViewModel";
import { useActiveCanvasSelector } from "../../../layout/hooks/activeCanvasStore";
import {
  buildSyntheticSpawnToolsFromChildren,
  injectSyntheticSubagentToolsIfNeeded,
  shouldInjectChildSubagentSynthetic,
} from "../../../subagent-ui";

type UseMessagesPresentationStateInput = {
  activeEngine: EngineType;
  claudeDockedReasoningItemCount: number;
  collapsedHistoryItemCount: number;
  deferredRenderSourceItems: ConversationItem[];
  hideClaudeReasoning: boolean;
  historyRestoredAtMs: number | null;
  isAssistantFinalizing: boolean;
  isHistoryLoading: boolean;
  isThinking: boolean;
  latestReasoningId: string | null;
  liveAssistantMessageId: string | null;
  messagesPresentationMode: MessagesPresentationMode;
  presentationRenderedItems: ConversationItem[];
  renderScopeKey: string;
  renderSourceItems: ConversationItem[];
  supportsStreamingReadableWindowRecovery: boolean;
  /** 本 Messages 实例绑定的 thread（嵌套子会话幕布必须是 grok:/claude:…，禁止用主 canvas） */
  threadId?: string | null;
  timelineItems: ConversationItem[];
};

export function useMessagesPresentationState({
  activeEngine,
  claudeDockedReasoningItemCount,
  collapsedHistoryItemCount,
  deferredRenderSourceItems,
  hideClaudeReasoning,
  historyRestoredAtMs,
  isAssistantFinalizing,
  isHistoryLoading,
  isThinking,
  latestReasoningId,
  liveAssistantMessageId,
  messagesPresentationMode,
  presentationRenderedItems,
  renderScopeKey,
  renderSourceItems,
  supportsStreamingReadableWindowRecovery,
  threadId = null,
  timelineItems,
}: UseMessagesPresentationStateInput) {
  const presentationScopeKey = buildMessagesPresentationScopeKey({
    scopeKey: renderScopeKey,
    mode: messagesPresentationMode,
    collapsedHistoryItemCount,
    itemCount: presentationRenderedItems.length,
    firstItemId: presentationRenderedItems[0]?.id ?? null,
    lastItemId: presentationRenderedItems.at(-1)?.id ?? null,
  });
  const claudeRenderableEntryCount = useMemo(
    () => countRenderableCollapsedEntries(timelineItems, activeEngine),
    [activeEngine, timelineItems],
  );
  const claudeHistoryTranscriptFallbackActive = useMemo(() => {
    if (activeEngine !== "claude" || isThinking || isHistoryLoading) {
      return false;
    }
    if (historyRestoredAtMs == null || claudeRenderableEntryCount > 0) {
      return false;
    }
    return isClaudeHistoryTranscriptHeavy(timelineItems);
  }, [
    activeEngine,
    claudeRenderableEntryCount,
    historyRestoredAtMs,
    isHistoryLoading,
    isThinking,
    timelineItems,
  ]);
  const presentationRenderSnapshot = useMemo(
    () => ({ scopeKey: presentationScopeKey, items: presentationRenderedItems }),
    [presentationRenderedItems, presentationScopeKey],
  );
  const deferredPresentationRenderSnapshot = useDeferredValue(presentationRenderSnapshot);
  const deferredPresentationRenderedItems =
    deferredPresentationRenderSnapshot.scopeKey === presentationScopeKey
      ? deferredPresentationRenderSnapshot.items
      : presentationRenderedItems;
  const shouldStabilizePresentationItems =
    supportsStreamingReadableWindowRecovery && (isThinking || isAssistantFinalizing);
  const livePresentationOverrideItemIds = useMemo(() => {
    if (!liveAssistantMessageId && !latestReasoningId) {
      return undefined;
    }
    return new Set(
      [liveAssistantMessageId, latestReasoningId].filter(
        (id): id is string => Boolean(id),
      ),
    );
  }, [latestReasoningId, liveAssistantMessageId]);
  const timelinePresentationItems = useMemo(() => {
    if (claudeHistoryTranscriptFallbackActive) {
      return timelineItems;
    }
    return resolveStreamingPresentationItems(
      deferredPresentationRenderedItems,
      presentationRenderedItems,
      shouldStabilizePresentationItems,
      livePresentationOverrideItemIds,
      {
        deferredScopeKey: deferredPresentationRenderSnapshot.scopeKey,
        currentScopeKey: presentationScopeKey,
      },
    );
  }, [
    claudeHistoryTranscriptFallbackActive,
    deferredPresentationRenderSnapshot.scopeKey,
    deferredPresentationRenderedItems,
    livePresentationOverrideItemIds,
    presentationRenderedItems,
    presentationScopeKey,
    shouldStabilizePresentationItems,
    timelineItems,
  ]);
  const hiddenClaudeReasoningOnly =
    activeEngine === "claude" &&
    hideClaudeReasoning &&
    deferredRenderSourceItems.length > 0 &&
    deferredRenderSourceItems.every(isReasoningConversationItem) &&
    timelinePresentationItems.length === 0 &&
    claudeDockedReasoningItemCount === 0;
  const liveAssistantItem = useMemo(() => {
    const item = findItemById(renderSourceItems, liveAssistantMessageId);
    return item && isAssistantMessageConversationItem(item) ? item : null;
  }, [liveAssistantMessageId, renderSourceItems]);
  const liveReasoningItem = useMemo(() => {
    if (!isThinking) {
      return null;
    }
    const item = findItemById(renderSourceItems, latestReasoningId);
    return item && isReasoningConversationItem(item) ? item : null;
  }, [isThinking, latestReasoningId, renderSourceItems]);

  // 子会话合成小队：
  // - Shared 父：投影常缺 spawn tool（既有）
  // - Codex native live wait 缺口：侧栏已有 children、timeline 无可识别 spawn 卡
  // 必须用本 Messages 的 threadId 与 canvas threadId 对齐，禁止嵌套详情再注入父小队。
  const childSubagentThreads = useActiveCanvasSelector(
    (snapshot) => snapshot.childSubagentThreads,
  );
  const canvasThreadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);
  const threadStatusById = useActiveCanvasSelector(
    (snapshot) => snapshot.threadStatusById,
  );
  const threadItemsByThread = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread,
  );
  const timelineItemsForGrouping = useMemo(() => {
    const ownThreadId = threadId?.trim() || "";
    if (
      !shouldInjectChildSubagentSynthetic({
        ownThreadId,
        canvasThreadId,
        activeEngine,
        items: timelinePresentationItems,
        childCount: childSubagentThreads.length,
      })
    ) {
      return timelinePresentationItems;
    }
    const idPrefix =
      ownThreadId.startsWith("shared:") && activeEngine !== "codex"
        ? "shared"
        : activeEngine === "codex"
          ? "codex"
          : "shared";
    const synthetic = buildSyntheticSpawnToolsFromChildren(childSubagentThreads, {
      statusById: threadStatusById,
      itemsByThread: threadItemsByThread,
      idPrefix,
    });
    return injectSyntheticSubagentToolsIfNeeded(timelinePresentationItems, synthetic);
  }, [
    activeEngine,
    canvasThreadId,
    childSubagentThreads,
    threadId,
    threadItemsByThread,
    threadStatusById,
    timelinePresentationItems,
  ]);

  const groupedEntries = useMemo(
    () => groupToolItems(timelineItemsForGrouping),
    [timelineItemsForGrouping],
  );
  const liveAutoExpandedExploreId = useMemo(
    () => resolveLiveAutoExpandedExploreId(groupedEntries, isThinking),
    [groupedEntries, isThinking],
  );
  const assistantFinalBoundarySet = useMemo(
    () => buildAssistantFinalBoundarySet(timelinePresentationItems),
    [timelinePresentationItems],
  );
  // File-change summary must read the uncollapsed process stream. Causal phase
  // collapse hides tool rows from the timeline, but the turn summary card still
  // needs those fileChange/edit tools as its data source.
  const turnFileChangesByBoundaryId = useMemo(
    () =>
      buildTurnFileChangesByBoundaryId(
        deferredRenderSourceItems.length > 0
          ? deferredRenderSourceItems
          : timelinePresentationItems,
      ),
    [deferredRenderSourceItems, timelinePresentationItems],
  );
  const sessionFileChangesSummary = useMemo(
    () => mergeTurnFileChangesSummaries(turnFileChangesByBoundaryId.values()),
    [turnFileChangesByBoundaryId],
  );
  const assistantLiveTurnFinalBoundarySuppressedSet = useMemo(() => {
    const ids = new Set<string>();
    if (!liveAssistantMessageId) {
      return ids;
    }
    let lastUserIndex = -1;
    for (let index = timelinePresentationItems.length - 1; index >= 0; index -= 1) {
      const entry = timelinePresentationItems[index];
      if (entry?.kind === "message" && entry.role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) {
      return ids;
    }
    for (let index = lastUserIndex + 1; index < timelinePresentationItems.length; index += 1) {
      const entry = timelinePresentationItems[index];
      if (
        entry?.kind === "message" &&
        entry.role === "assistant" &&
        entry.isFinal === true &&
        assistantFinalBoundarySet.has(entry.id) &&
        (isThinking || entry.id === liveAssistantMessageId)
      ) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [assistantFinalBoundarySet, isThinking, liveAssistantMessageId, timelinePresentationItems]);
  const suppressedUserNoteCardContextMessageIds = useMemo(
    () => buildSuppressedUserNoteCardContextMessageIdSet(timelinePresentationItems),
    [timelinePresentationItems],
  );
  const suppressedUserMemoryContextMessageIds = useMemo(
    () => buildSuppressedUserMemoryContextMessageIdSet(timelinePresentationItems),
    [timelinePresentationItems],
  );
  const turnTargetBadgeVisibleItemIds = useMemo(
    () => buildTurnTargetBadgeVisibleItemIds(timelinePresentationItems),
    [timelinePresentationItems],
  );

  return {
    assistantFinalBoundarySet,
    assistantLiveTurnFinalBoundarySuppressedSet,
    claudeHistoryTranscriptFallbackActive,
    groupedEntries,
    hiddenClaudeReasoningOnly,
    liveAssistantItem,
    liveAutoExpandedExploreId,
    liveReasoningItem,
    presentationScopeKey,
    sessionFileChangesSummary,
    suppressedUserMemoryContextMessageIds,
    suppressedUserNoteCardContextMessageIds,
    timelinePresentationItems,
    turnFileChangesByBoundaryId,
    turnTargetBadgeVisibleItemIds,
  };
}
