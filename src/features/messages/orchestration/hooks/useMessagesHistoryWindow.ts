import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { ConversationItem } from "../../../../types";
import { VISIBLE_MESSAGE_WINDOW } from "../../utils/messagesRenderUtils";
import {
  readHistoryWindowSize,
  resolveHistoryWindowCutIndex,
} from "../presentation/messagesHistoryWindow";
import {
  buildRenderedItemsWindow,
  resolveMessagesPresentationMode,
  type MessagesHistoryExpansionMode,
} from "../presentation/messagesLiveWindow";
import {
  findLatestAssistantTextLength,
  mergeReadableRecoveryItems,
  type PreservedReadableWindow,
} from "../presentation/messagesViewModel";

type UseMessagesHistoryWindowInput = {
  /**
   * Conversation identity (workspace + thread). Must stay stable across
   * older-history prepends — those change `items[0].id` but are the same session.
   */
  scopeKey: string | null;
};

export function useMessagesHistoryWindow({ scopeKey }: UseMessagesHistoryWindowInput) {
  const [showAllHistoryItems, setShowAllHistoryItems] = useState(false);
  const [historyExpansionMode, setHistoryExpansionMode] =
    useState<MessagesHistoryExpansionMode>(null);
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState<string | null>(null);
  // 会话内展开预算：磁盘页 / 内存余量都按 prependedCount 累加，默认一页 500。
  const [revealedHistoryItemCount, setRevealedHistoryItemCount] = useState(0);
  const pendingHistoryExpansionModeRef = useRef<MessagesHistoryExpansionMode>(null);
  const scopeKeyRef = useRef<string | null>(scopeKey);

  useEffect(() => {
    if (scopeKey !== scopeKeyRef.current) {
      // pre-dispatch：默认态不得换新引用 / 虚写（#185 防御）
      setShowAllHistoryItems((previous) => (previous ? false : previous));
      setHistoryExpansionMode((previous) =>
        previous === null ? previous : null,
      );
      setPendingJumpMessageId((previous) =>
        previous === null ? previous : null,
      );
      setRevealedHistoryItemCount((previous) => (previous === 0 ? previous : 0));
      pendingHistoryExpansionModeRef.current = null;
    }
    scopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  const revealAllHistoryItems = useCallback((mode: "manual" | "jump") => {
    pendingHistoryExpansionModeRef.current = mode;
    setHistoryExpansionMode(mode);
    setShowAllHistoryItems(true);
  }, []);
  const revealNextHistoryPage = useCallback((pageSize: number) => {
    if (pageSize <= 0) {
      return;
    }
    setRevealedHistoryItemCount((previous) => previous + pageSize);
  }, []);
  const consumePendingHistoryExpansionMode = useCallback(() => {
    const mode = pendingHistoryExpansionModeRef.current;
    pendingHistoryExpansionModeRef.current = null;
    return mode;
  }, []);
  const discardPendingHistoryExpansion = useCallback(() => {
    pendingHistoryExpansionModeRef.current = null;
  }, []);
  const requestPendingJumpMessage = useCallback((messageId: string) => {
    setPendingJumpMessageId((previous) => (previous === messageId ? previous : messageId));
  }, []);
  const clearPendingJumpMessage = useCallback(() => {
    setPendingJumpMessageId(null);
  }, []);
  const resetHistoryScope = useCallback(() => {
    setShowAllHistoryItems((previous) => (previous ? false : previous));
    setHistoryExpansionMode((previous) => (previous === null ? previous : null));
    setPendingJumpMessageId((previous) => (previous === null ? previous : null));
    setRevealedHistoryItemCount((previous) => (previous === 0 ? previous : 0));
    pendingHistoryExpansionModeRef.current = null;
  }, []);

  return {
    clearPendingJumpMessage,
    consumePendingHistoryExpansionMode,
    discardPendingHistoryExpansion,
    historyExpansionMode,
    pendingJumpMessageId,
    requestPendingJumpMessage,
    resetHistoryScope,
    revealAllHistoryItems,
    revealNextHistoryPage,
    revealedHistoryItemCount,
    showAllHistoryItems,
  };
}

type LiveTailWorkingSet = {
  omittedBeforeWorkingSetCount: number;
  preservedUserMessageId: string | null;
};

type UseMessagesHistoryPresentationWindowInput = {
  activeTurnId: string | null;
  blankingRecoveryActive: boolean;
  effectiveItemsLength: number;
  historyExpansionMode: MessagesHistoryExpansionMode;
  isThinking: boolean;
  isWorking: boolean;
  liveTailWorkingSet: LiveTailWorkingSet;
  readableWindowRecoveryActive: boolean;
  revealedHistoryItemCount: number;
  showAllHistoryItems: boolean;
  supportsStreamingReadableWindowRecovery: boolean;
  threadId: string | null;
  timelineItems: ConversationItem[];
  visibleStallRecoveryActive: boolean;
  /**
   * 钉底跟随 ref（useMessagesCanvasFollow.isUserAtBottomRef）。
   * 用户上翻阅读时（false）冻结窗口：新追加不收起最老段，避免阅读锚点被裁跳屏；
   * 展开（切口回缩）不受此闸门限制，随时生效。
   */
  windowCollapseAllowedRef: MutableRefObject<boolean>;
  workspaceId: string | null;
};

export function useMessagesHistoryPresentationWindow({
  activeTurnId,
  blankingRecoveryActive,
  effectiveItemsLength,
  historyExpansionMode,
  isThinking,
  isWorking,
  liveTailWorkingSet,
  readableWindowRecoveryActive,
  revealedHistoryItemCount,
  showAllHistoryItems,
  supportsStreamingReadableWindowRecovery,
  threadId,
  timelineItems,
  visibleStallRecoveryActive,
  windowCollapseAllowedRef,
  workspaceId,
}: UseMessagesHistoryPresentationWindowInput) {
  const preservedReadableWindowRef = useRef<PreservedReadableWindow>({
    workspaceId: null,
    threadId: null,
    turnId: null,
    renderedItems: [],
    visibleCollapsedHistoryItemCount: 0,
  });
  // 历史窗口（03 号清单）：flag 开时生效的小窗口 + VISIBLE_MESSAGE_WINDOW 硬兜底。
  const historyWindowSize = readHistoryWindowSize();
  const effectiveWindowSize =
    historyWindowSize > 0
      ? Math.min(historyWindowSize, VISIBLE_MESSAGE_WINDOW)
      : VISIBLE_MESSAGE_WINDOW;
  const targetTimelineCollapsedCount = showAllHistoryItems
    ? 0
    : resolveHistoryWindowCutIndex({
        items: timelineItems,
        windowSize: effectiveWindowSize,
        revealedItemCount: revealedHistoryItemCount,
        activeTurnId,
      });
  // 冻结闸门：仅钉底时允许切口加深（收起更多）；用户上翻阅读时保持既有窗口。
  // 展开（目标 < 当前）始终立即生效；跨会话 scope 切换时重置。
  const collapseScopeRef = useRef<{ scopeKey: string; collapsedCount: number }>({
    scopeKey: "",
    collapsedCount: 0,
  });
  const collapseScopeKey = `${workspaceId ?? ""}\u0000${threadId ?? ""}`;
  if (collapseScopeRef.current.scopeKey !== collapseScopeKey) {
    collapseScopeRef.current = {
      scopeKey: collapseScopeKey,
      collapsedCount: targetTimelineCollapsedCount,
    };
  } else if (
    windowCollapseAllowedRef.current ||
    targetTimelineCollapsedCount < collapseScopeRef.current.collapsedCount
  ) {
    collapseScopeRef.current = {
      scopeKey: collapseScopeKey,
      collapsedCount: targetTimelineCollapsedCount,
    };
  }
  const timelineCollapsedHistoryItemCount = collapseScopeRef.current.collapsedCount;
  const collapsedHistoryItemCount =
    liveTailWorkingSet.omittedBeforeWorkingSetCount + timelineCollapsedHistoryItemCount;
  const renderedItemsWindow = useMemo(
    () =>
      buildRenderedItemsWindow(
        timelineItems,
        timelineCollapsedHistoryItemCount,
        liveTailWorkingSet.preservedUserMessageId,
      ),
    [
      liveTailWorkingSet.preservedUserMessageId,
      timelineCollapsedHistoryItemCount,
      timelineItems,
    ],
  );
  const renderedItems = renderedItemsWindow.renderedItems;
  const visibleCollapsedHistoryItemCount =
    collapsedHistoryItemCount > 0
      ? renderedItemsWindow.visibleCollapsedHistoryItemCount +
        liveTailWorkingSet.omittedBeforeWorkingSetCount
      : 0;
  const messagesPresentationMode = resolveMessagesPresentationMode({
    historyExpansionMode,
    isWorking,
    showAllHistoryItems,
    visibleCollapsedHistoryItemCount,
  });
  const currentLatestAssistantTextLength = useMemo(
    () => findLatestAssistantTextLength(renderedItems),
    [renderedItems],
  );

  useEffect(() => {
    const currentWorkspaceId = workspaceId ?? null;
    const currentThreadId = threadId ?? null;
    const currentTurnId = activeTurnId;
    if (
      preservedReadableWindowRef.current.workspaceId !== currentWorkspaceId ||
      preservedReadableWindowRef.current.threadId !== currentThreadId ||
      preservedReadableWindowRef.current.turnId !== currentTurnId
    ) {
      preservedReadableWindowRef.current = {
        workspaceId: currentWorkspaceId,
        threadId: currentThreadId,
        turnId: currentTurnId,
        renderedItems: renderedItems.length > 0 ? renderedItems : [],
        visibleCollapsedHistoryItemCount:
          renderedItems.length > 0 ? visibleCollapsedHistoryItemCount : 0,
      };
      return;
    }
    if (renderedItems.length > 0) {
      if (readableWindowRecoveryActive) {
        return;
      }
      preservedReadableWindowRef.current = {
        workspaceId: currentWorkspaceId,
        threadId: currentThreadId,
        turnId: currentTurnId,
        renderedItems,
        visibleCollapsedHistoryItemCount,
      };
      return;
    }
    if (!isThinking) {
      preservedReadableWindowRef.current = {
        workspaceId: currentWorkspaceId,
        threadId: currentThreadId,
        turnId: null,
        renderedItems: [],
        visibleCollapsedHistoryItemCount: 0,
      };
    }
  }, [
    activeTurnId,
    isThinking,
    readableWindowRecoveryActive,
    renderedItems,
    threadId,
    visibleCollapsedHistoryItemCount,
    workspaceId,
  ]);

  const preservedReadableWindowSnapshot = preservedReadableWindowRef.current;
  const preservedLatestAssistantTextLength = findLatestAssistantTextLength(
    preservedReadableWindowSnapshot.renderedItems,
  );
  const hasPreservedReadableWindow =
    (readableWindowRecoveryActive || supportsStreamingReadableWindowRecovery) &&
    preservedReadableWindowSnapshot.workspaceId === (workspaceId ?? null) &&
    preservedReadableWindowSnapshot.threadId === (threadId ?? null) &&
    preservedReadableWindowSnapshot.turnId === activeTurnId &&
    preservedReadableWindowSnapshot.renderedItems.length > 0;
  const renderChainBlankingRegressionActive =
    supportsStreamingReadableWindowRecovery &&
    isThinking &&
    effectiveItemsLength > 0 &&
    renderedItems.length === 0;
  const shouldUseReadableWindowRecovery =
    hasPreservedReadableWindow &&
    (renderChainBlankingRegressionActive ||
      (blankingRecoveryActive && renderedItems.length === 0) ||
      (visibleStallRecoveryActive &&
        currentLatestAssistantTextLength > 0 &&
        currentLatestAssistantTextLength < preservedLatestAssistantTextLength));
  const recoveredReadableWindow = useMemo(() => {
    if (!shouldUseReadableWindowRecovery) {
      return null;
    }
    return {
      renderedItems: mergeReadableRecoveryItems(
        preservedReadableWindowSnapshot.renderedItems,
        renderedItems,
      ),
      visibleCollapsedHistoryItemCount:
        preservedReadableWindowSnapshot.visibleCollapsedHistoryItemCount,
    };
  }, [preservedReadableWindowSnapshot, renderedItems, shouldUseReadableWindowRecovery]);
  const presentationRenderedItems = shouldUseReadableWindowRecovery
    ? recoveredReadableWindow?.renderedItems ?? renderedItems
    : renderedItems;
  const presentationCollapsedHistoryItemCount = shouldUseReadableWindowRecovery
    ? recoveredReadableWindow?.visibleCollapsedHistoryItemCount ??
      visibleCollapsedHistoryItemCount
    : visibleCollapsedHistoryItemCount;

  return {
    messagesPresentationMode,
    presentationCollapsedHistoryItemCount,
    presentationRenderedItems,
    preservedLatestAssistantTextLength,
    preservedReadableWindowItemCount: preservedReadableWindowSnapshot.renderedItems.length,
    renderChainBlankingRegressionActive,
    renderedItems,
    shouldUseReadableWindowRecovery,
    timelineCollapsedHistoryItemCount,
    visibleCollapsedHistoryItemCount,
  };
}
