import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { ConversationItem } from "../../../types";
import { isMacPlatform, isWindowsPlatform } from "../../../utils/platform";
import {
  noteThreadVisibleTextRendered,
  noteThreadVisibleRender,
  resolveActiveThreadStreamMitigation,
  useThreadStreamLatencySnapshot,
} from "../../threads/utils/streamLatencyDiagnostics";
import { useStreamActivityPhase } from "../../threads/hooks/useStreamActivityPhase";
import type { AgentTaskScrollRequest } from "../types";
import { getVisibleApprovalsForThread } from "../../../utils/approvalBatching";
import {
  MESSAGES_LIVE_AUTO_FOLLOW_FLAG_KEY,
  MESSAGES_LIVE_COLLAPSE_MIDDLE_STEPS_FLAG_KEY,
  MESSAGES_LIVE_CONTROLS_UPDATED_EVENT,
  readLocalBooleanFlag,
  writeLocalBooleanFlag,
} from "../constants/liveCanvasControls";
import {
  RendererContextMenu,
} from "../../../components/ui/RendererContextMenu";
import { appendRendererDiagnostic } from "../../../services/rendererDiagnostics";
import { MessagesTimeline } from "./MessagesTimeline";
import { MessagesAnchorRail } from "./conversation/MessagesAnchorRail";
import { ScrollControl } from "./conversation/ScrollControl";
import {
  MessagesInlineApproval,
  MessagesInlineUserInput,
} from "./conversation/MessagesInlinePrompts";
import {
  parseReasoning,
} from "../presentation/messagesReasoning";
import {
  buildLiveTailWorkingSet,
  suppressCompletedExploreItemsBetweenLatestUserTurns,
} from "../orchestration/presentation/messagesLiveWindow";
import {
  isAssistantMessageConversationItem,
  isReasoningConversationItem,
  isUserMessageConversationItem,
} from "../utils/messageItemPredicates";
import { parseAgentTaskNotification } from "../../engine-task-output/contracts/agentTaskNotification";
import { dedupeExitPlanItemsKeepFirst } from "../utils/messagesExitPlan";
import {
  findLastAssistantMessageIndex,
  findLastUserMessageIndex,
  isMessagesPerfDebugEnabled,
  isSelectionInsideNode,
  logClaudeRender,
  logMessagesPerf,
  MESSAGES_SLOW_ANCHOR_WARN_MS,
  MESSAGES_SLOW_RENDER_WARN_MS,
  resolveWorkingActivityLabel,
  shouldDisplayWorkingActivityLabel,
  shouldHideClaudeReasoningModule,
  STREAMING_VISIBLE_WINDOW,
} from "../utils/messagesRenderUtils";
import {
  buildMessageActionTargets,
  buildMessagesScrollKey,
  resolveActiveUserInputRequest,
  resolveActiveMessageAnchor,
  resolveCollapsedTimelineItems,
  resolveVisibleMessageItems,
  type MessageActionTargets,
} from "../orchestration/presentation/messagesViewModel";
import {
  INITIAL_BOTTOM_PIN_BUDGET_MS,
  SETTLE_REPIN_WINDOW_MS,
} from "../constants/messagesConstants";
import {
  DEFAULT_RENDER_LOOP_GUARD_BUDGET,
  resolveIdempotentRenderLoopGuard,
  type RenderLoopGuardBudget,
} from "../timeline/virtualization/messagesRenderLoopGuards";
import { addBoundedConversationRenderModeKey } from "../presentation/messagesConversationLightweightMode";
import type { LastRenderSnapshot } from "../types/messagesTypes";
import type { MessagesCoreProps } from "../contracts/messagesInput";
import { useMessagesTimelineModels } from "../orchestration/hooks/useMessagesTimelineModels";
import { useMessagesAnchorNavigation } from "../orchestration/hooks/useMessagesAnchorNavigation";
import { useMessagesRuntimeState } from "../orchestration/hooks/useMessagesRuntimeState";
import {
  useMessagesHistoryPresentationWindow,
  useMessagesHistoryWindow,
} from "../orchestration/hooks/useMessagesHistoryWindow";
import { useMessagesPresentationState } from "../orchestration/hooks/useMessagesPresentationState";
import { useMessagesScrollController } from "../orchestration/hooks/useMessagesScrollController";
import { useMessagesInteractions } from "../orchestration/hooks/useMessagesInteractions";
import { MessagesLinkedRunBanner } from "../orchestration/components/MessagesLinkedRunBanner";

const EMPTY_TASK_RUNS: NonNullable<MessagesCoreProps["runtime"]["taskRuns"]> = [];

const ANCHOR_TITLE_MAX_LENGTH = 60;
const PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX = 2;

function isAgentTaskNotificationText(text: string) {
  return Boolean(parseAgentTaskNotification(text));
}

/**
 * Derive a short, human-readable label for an anchor dot from the raw
 * user message text: take the first non-empty line, collapse inner
 * whitespace, and truncate. Used for the hover tooltip + outline label
 * on the messages anchor rail.
 */
function deriveAnchorTitle(text: string): string {
  const firstLine =
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const normalized = firstLine.replace(/\s+/g, " ");
  return normalized.length > ANCHOR_TITLE_MAX_LENGTH
    ? `${normalized.slice(0, ANCHOR_TITLE_MAX_LENGTH)}…`
    : normalized;
}

// 流式期间每个 token 都会替换 items 数组引用,但通常只有最后一条正在流式输出的
// assistant/user "message" 条目发生了文本变化,其余条目引用保持不变。此时
// dedupeExitPlanItemsKeepFirst / buildMessageActionTargets 的计算结果必然与上一次
// 完全相同(两者都只关心 tool 条目身份或 role/isFinal 边界,不关心文本内容本身),
// 可以安全复用缓存结果,避免对整段历史重新扫描。
// 一旦出现条目增删、非 message 类型条目变化,或 role/isFinal 发生翻转,则回退到全量重算,
// 保证 idle/展开态下覆盖全部历史的正确性不受影响。
function isTrailingMessageTextOnlyUpdate(
  prev: ConversationItem[],
  next: ConversationItem[],
): boolean {
  if (prev.length === 0 || prev.length !== next.length) {
    return false;
  }
  const lastIndex = prev.length - 1;
  for (let index = 0; index < lastIndex; index += 1) {
    if (prev[index] !== next[index]) {
      return false;
    }
  }
  const prevLast = prev[lastIndex];
  const nextLast = next[lastIndex];
  if (prevLast === nextLast) {
    return true;
  }
  return (
    prevLast.kind === "message" &&
    nextLast.kind === "message" &&
    prevLast.id === nextLast.id &&
    prevLast.role === nextLast.role &&
    prevLast.isFinal === nextLast.isFinal
  );
}

export const MessagesCore = memo(function MessagesCore({
  conversation,
  runtime,
  interactions,
  presentation,
}: MessagesCoreProps) {
  const { state: conversationState, workspacePath = null } = conversation;
  const {
    isHistoryLoading = false,
    historyRecoveryFailureReason = null,
    isContextCompacting = false,
    proxyEnabled = false,
    proxyUrl = null,
    processingStartedAt = null,
    lastDurationMs = null,
    codexSilentSuspectedAt = null,
    approvals = [],
    taskRuns = EMPTY_TASK_RUNS,
  } = runtime;
  const {
    onRetryHistory,
    onUserInputSubmit: legacyOnUserInputSubmit,
    onUserInputDismiss: legacyOnUserInputDismiss,
    onApprovalDecision,
    onApprovalBatchAccept,
    onApprovalRemember,
    onOpenDiffPath,
    onPreviewFileDiff,
    onOpenWorkspaceFile,
    onCaptureNote,
    onExitPlanModeExecute,
    onRecoverThreadRuntime,
    onRecoverThreadRuntimeAndResend,
    onThreadRecoveryFork,
    onForkFromMessage,
    onRewindFromMessage,
  } = interactions;
  const {
    openTargets,
    selectedOpenAppId,
    showMessageAnchors = true,
    codeBlockCopyUseModifier = false,
    workspaces = [],
    claudeThinkingVisible,
    activeCollaborationModeId = null,
    isPlanMode: _isPlanMode = false,
    isPlanProcessing: _isPlanProcessing = false,
    presentationProfile = null,
    agentTaskScrollRequest = null,
  } = presentation;
  const { t } = useTranslation();
  const isWindowsDesktop = useMemo(() => isWindowsPlatform(), []);
  const isMacDesktop = useMemo(() => isMacPlatform(), []);
  const items = conversationState.items;
  const userInputRequests = conversationState.userInputQueue;
  const workspaceId = conversationState.meta.workspaceId || null;
  const threadId = conversationState.meta.threadId || null;
  const activeTurnId = conversationState.meta.activeTurnId ?? null;
  const activeEngine = conversationState.meta.engine;
  const renderScopeKey = `${workspaceId ?? ""}\u0000${threadId ?? ""}`;
  const conversationRenderModeKey =
    workspaceId && threadId ? `${workspaceId}\u0000${threadId}` : null;
  const isThinking = conversationState.meta.isThinking;
  const isWorking = isThinking || isContextCompacting;
  const heartbeatPulse = conversationState.meta.heartbeatPulse ?? 0;
  const {
    clearPendingJumpMessage,
    consumePendingHistoryExpansionMode,
    discardPendingHistoryExpansion,
    historyExpansionMode,
    pendingJumpMessageId,
    requestPendingJumpMessage,
    resetHistoryScope,
    revealAllHistoryItems,
    showAllHistoryItems,
  } = useMessagesHistoryWindow({ firstItemId: items[0]?.id ?? null });
  const renderStartedAt =
    typeof performance === "undefined" ? 0 : performance.now();
  const settleRepinPrevThinkingRef = useRef(isThinking);
  const messageNodeByIdRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const agentTaskNodeByTaskIdRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const agentTaskNodeByToolUseIdRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const anchorUpdateRafRef = useRef<number | null>(null);
  const lastRenderSnapshotRef = useRef<LastRenderSnapshot | null>(null);
  const [lightweightConversationKeys, setLightweightConversationKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [detailHydrationConversationKeys, setDetailHydrationConversationKeys] = useState<
    Set<string>
  >(() => new Set());
  const conversationLightweightModeEnabled = Boolean(
    conversationRenderModeKey && lightweightConversationKeys.has(conversationRenderModeKey),
  );
  const conversationDetailHydrationRequested = Boolean(
    conversationRenderModeKey && detailHydrationConversationKeys.has(conversationRenderModeKey),
  );
  const handleConversationLightweightModeEnable = useCallback(() => {
    if (!conversationRenderModeKey) {
      return;
    }
    setLightweightConversationKeys((previous) => {
      return addBoundedConversationRenderModeKey(previous, conversationRenderModeKey);
    });
    setDetailHydrationConversationKeys((previous) => {
      if (!previous.has(conversationRenderModeKey)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(conversationRenderModeKey);
      return next;
    });
  }, [conversationRenderModeKey]);
  const handleConversationDetailHydrationRequest = useCallback(() => {
    if (!conversationRenderModeKey) {
      return;
    }
    setDetailHydrationConversationKeys((previous) => {
      return addBoundedConversationRenderModeKey(previous, conversationRenderModeKey);
    });
    setLightweightConversationKeys((previous) => {
      if (!previous.has(conversationRenderModeKey)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(conversationRenderModeKey);
      return next;
    });
  }, [conversationRenderModeKey]);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const activeAnchorIdRef = useRef<string | null>(null);
  const anchorLoopGuardRef = useRef<RenderLoopGuardBudget>(
    DEFAULT_RENDER_LOOP_GUARD_BUDGET,
  );
  const [liveAutoFollowEnabled, setLiveAutoFollowEnabled] = useState(() =>
    readLocalBooleanFlag(MESSAGES_LIVE_AUTO_FOLLOW_FLAG_KEY, true),
  );
  const [collapseLiveMiddleStepsEnabled, setCollapseLiveMiddleStepsEnabled] = useState(() =>
    readLocalBooleanFlag(MESSAGES_LIVE_COLLAPSE_MIDDLE_STEPS_FLAG_KEY, false),
  );
  const liveAutoFollowEnabledRef = useRef(liveAutoFollowEnabled);
  liveAutoFollowEnabledRef.current = liveAutoFollowEnabled;
  const collapseLiveMiddleStepsEnabledRef = useRef(collapseLiveMiddleStepsEnabled);
  collapseLiveMiddleStepsEnabledRef.current = collapseLiveMiddleStepsEnabled;
  const legacyClaudeReasoningDockEnabled =
    activeEngine === "claude" &&
    typeof claudeThinkingVisible !== "boolean" &&
    shouldHideClaudeReasoningModule();
  const hideClaudeReasoning =
    activeEngine === "claude" &&
    (typeof claudeThinkingVisible === "boolean"
      ? !claudeThinkingVisible
      : legacyClaudeReasoningDockEnabled);
  const [isSelectionFrozen, setIsSelectionFrozen] = useState(false);
  const enableCollaborationBadge = activeEngine === "codex";
  const planPanelFocusRafRef = useRef<number | null>(null);
  const planPanelFocusTimeoutRef = useRef<number | null>(null);
  const planPanelFocusNodeRef = useRef<HTMLElement | null>(null);
  const lastStreamSurfaceDiagnosticKeyRef = useRef<string | null>(null);
  const resourceCleanupThreadIdRef = useRef(threadId);
  const frozenItemsRef = useRef<ConversationItem[] | null>(null);
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;
  const exitPlanDedupeCacheRef = useRef<{
    baseItems: ConversationItem[];
    result: ConversationItem[];
  } | null>(null);
  const effectiveItems = useMemo(() => {
    const baseItems = isSelectionFrozen
      ? frozenItemsRef.current ?? items
      : items;
    const cache = exitPlanDedupeCacheRef.current;
    if (cache && isTrailingMessageTextOnlyUpdate(cache.baseItems, baseItems)) {
      // dedupe 只会移除 exit-plan 工具条目,末尾的 "message" 条目必然原样透传,
      // 因此只需把结果数组的最后一项替换为最新引用,无需重新扫描整段历史。
      // 尾项引用未变时(如选区冻结触发的引用级重算)必须原样返回缓存:此时尾项
      // 可能是被去重掉的 exit-plan 条目,写回结果末尾会丢真尾项、复活重复项。
      const nextLast = baseItems[baseItems.length - 1];
      const result =
        cache.baseItems[cache.baseItems.length - 1] === nextLast ||
        cache.result[cache.result.length - 1] === nextLast
          ? cache.result
          : [...cache.result.slice(0, -1), nextLast];
      exitPlanDedupeCacheRef.current = { baseItems, result };
      return result;
    }
    const result = dedupeExitPlanItemsKeepFirst(baseItems);
    exitPlanDedupeCacheRef.current = { baseItems, result };
    return result;
  }, [isSelectionFrozen, items]);
  const messageActionTargetsCacheRef = useRef<{
    baseItems: ConversationItem[];
    result: MessageActionTargets;
  } | null>(null);
  const messageActionTargets = useMemo(() => {
    const cache = messageActionTargetsCacheRef.current;
    if (cache && isTrailingMessageTextOnlyUpdate(cache.baseItems, effectiveItems)) {
      messageActionTargetsCacheRef.current = { baseItems: effectiveItems, result: cache.result };
      return cache.result;
    }
    const result = buildMessageActionTargets(effectiveItems);
    messageActionTargetsCacheRef.current = { baseItems: effectiveItems, result };
    return result;
  }, [effectiveItems]);
  const liveTailWorkingSet = useMemo(
    () =>
      buildLiveTailWorkingSet(effectiveItems, {
        isThinking,
        showAllHistoryItems,
        // 流式期裁到 live 尾窗（buildLiveTailWorkingSet 仅在 isThinking 时裁剪）；
        // show all 只在 idle 恢复全量，避免展开历史后每个 token 都重跑完整 timeline。
        visibleWindow: STREAMING_VISIBLE_WINDOW,
        enableCollaborationBadge,
      }),
    [effectiveItems, enableCollaborationBadge, isThinking, showAllHistoryItems],
  );
  const renderSourceItems = liveTailWorkingSet.items;
  const renderSourceSnapshot = useMemo(
    () => ({
      scopeKey: renderScopeKey,
      items: renderSourceItems,
    }),
    [renderScopeKey, renderSourceItems],
  );
  const deferredRenderSourceSnapshot = useDeferredValue(renderSourceSnapshot);
  const deferredRenderSourceItems =
    deferredRenderSourceSnapshot.scopeKey === renderScopeKey
      ? deferredRenderSourceSnapshot.items
      : renderSourceItems;
  const threadStreamLatencySnapshot = useThreadStreamLatencySnapshot(threadId);
  const activeStreamMitigation = useMemo(
    () => resolveActiveThreadStreamMitigation(threadStreamLatencySnapshot),
    [threadStreamLatencySnapshot],
  );
  const streamActivityPhase = useStreamActivityPhase({
    isProcessing:
      isThinking &&
      (activeEngine === "codex" ||
        activeEngine === "claude" ||
        activeEngine === "gemini" ||
        activeEngine === "kimi"),
    items: deferredRenderSourceItems,
  });
  const {
    blankingRecoveryActive,
    enableClaudeRenderSafeMode,
    getPendingRuntimeResourceCount,
    handleAssistantVisibleTextRender,
    isAssistantFinalizing,
    isAssistantFinalizingRef,
    isWorkingRef,
    latestAssistantMessageId,
    latestRetryMessage,
    latestRuntimeReconnectItemId,
    liveAssistantMessageId,
    primaryWorkingLabel,
    readableWindowRecoveryActive,
    supportsStreamingReadableWindowRecovery,
    visibleStallRecoveryActive,
    waitingForFirstChunk,
  } = useMessagesRuntimeState({
    activeEngine,
    activeTurnId,
    codexSilentSuspectedAt,
    deferredRenderSourceItems,
    isContextCompacting,
    isMacDesktop,
    isAgentTaskNotificationText,
    isThinking,
    isWindowsDesktop,
    items,
    labels: {
      approvalResumingAfterApproval: t("approval.resumingAfterApproval"),
      codexSilentSuspected: t("messages.codexSilentSuspected"),
      codexWaitingForFirstText: t("messages.codexWaitingForFirstText"),
      contextCompacting: t("chat.contextDualViewCompacting"),
    },
    renderScopeKey,
    reportVisibleTextRendered: noteThreadVisibleTextRendered,
    renderSourceItems,
    streamActivityPhase,
    threadId,
    threadStreamLatencyCategory:
      threadStreamLatencySnapshot?.latencyCategory ?? null,
  });
  const activeUserInputRequest = resolveActiveUserInputRequest({
    requests: userInputRequests,
    threadId,
    workspaceId,
  });
  const activeUserInputRequestId = activeUserInputRequest?.request_id ?? null;
  const activeUserInputAnchorItemId =
    activeUserInputRequest?.params.item_id?.trim() || null;
  const rawScrollKey = buildMessagesScrollKey(effectiveItems, activeUserInputRequestId);
  const {
    activeProgrammaticScrollEdgeRef,
    activeProgrammaticScrollMotionRef,
    autoScrollRef,
    bottomRef,
    cancelFocusFollowConvergence,
    cancelScrollConvergence,
    containerRef,
    getPendingScrollResourceCount,
    handleScrollControlRequest,
    initialBottomPinScopeRef,
    isNearBottom,
    programmaticScrollTopEchoRef,
    rearmAutoFollowToBottom,
    recordProgrammaticScrollObservation,
    requestAutoScroll,
    requestHistoryBottomConvergence,
    requestSettleBottomConvergence,
    requestTimelineLayoutBottomConvergence,
    scrollKey,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
  } = useMessagesScrollController({
    clearPendingJumpMessage,
    isAssistantFinalizingRef,
    isThinking,
    isWorkingRef,
    liveAutoFollowEnabledRef,
    rawScrollKey,
    renderScopeKey,
  });
  const {
    closeFileLinkMenu,
    closeNoteCaptureMenu,
    collapseExpandedIds,
    collapseExploreItems,
    copiedMessageId,
    expandedItems,
    fileLinkMenu,
    getPendingInteractionResourceCount,
    handleConversationContextMenu,
    handleCopyMessage,
    handleExitPlanModeExecuteForItem,
    noteCaptureMenu,
    openFileLink,
    resetInteractionScope,
    selectedExitPlanExecutionByItemKey,
    showFileLinkMenu,
    timelineOpenNoteCaptureMenu,
    toggleExpanded,
  } = useMessagesInteractions({
    canvasRootRef: containerRef,
    effectiveItems,
    isThinking,
    items,
    onCaptureNote,
    onExitPlanModeExecute,
    onOpenWorkspaceFile,
    openTargets,
    renderSourceItems,
    selectedOpenAppId,
    threadId,
    workspacePath,
  });

  const computeActiveAnchor = useCallback(() => {
    return resolveActiveMessageAnchor(containerRef.current, messageNodeByIdRef.current);
  }, [containerRef]);

  const scrollToAgentTaskCard = useCallback((request: AgentTaskScrollRequest | null) => {
    if (!request) {
      return;
    }
    const container = containerRef.current;
    const node =
      (request.taskId
        ? agentTaskNodeByTaskIdRef.current.get(request.taskId)
        : null) ??
      (request.toolUseId
        ? agentTaskNodeByToolUseIdRef.current.get(request.toolUseId)
        : null);
    if (!node || !container) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetTop =
      container.scrollTop + (nodeRect.top - containerRect.top) - container.clientHeight * 0.22;
    autoScrollRef.current = false;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }, [autoScrollRef, containerRef]);

  useEffect(() => {
    const previousThreadId = resourceCleanupThreadIdRef.current;
    const threadChanged = previousThreadId !== threadId;
    const pendingResourceCounts = {
      anchorRaf: anchorUpdateRafRef.current !== null ? 1 : 0,
      planFocusRaf: planPanelFocusRafRef.current !== null ? 1 : 0,
      planFocusTimer: planPanelFocusTimeoutRef.current !== null ? 1 : 0,
      assistantFinalizingTimer: getPendingRuntimeResourceCount(),
      copyTimer: getPendingInteractionResourceCount(),
      scrollThrottleTimer: getPendingScrollResourceCount(),
      messageNodeCount: messageNodeByIdRef.current.size,
      agentTaskNodeCount:
        agentTaskNodeByTaskIdRef.current.size + agentTaskNodeByToolUseIdRef.current.size,
    };
    resetInteractionScope();
    setIsSelectionFrozen(false);
    frozenItemsRef.current = null;
    resetHistoryScope();
    activeAnchorIdRef.current = null;
    anchorLoopGuardRef.current = DEFAULT_RENDER_LOOP_GUARD_BUDGET;
    if (typeof window !== "undefined") {
      if (anchorUpdateRafRef.current !== null) {
        window.cancelAnimationFrame(anchorUpdateRafRef.current);
        anchorUpdateRafRef.current = null;
      }
      if (planPanelFocusRafRef.current !== null) {
        window.cancelAnimationFrame(planPanelFocusRafRef.current);
        planPanelFocusRafRef.current = null;
      }
      if (planPanelFocusTimeoutRef.current !== null) {
        window.clearTimeout(planPanelFocusTimeoutRef.current);
        planPanelFocusTimeoutRef.current = null;
      }
    }
    if (threadChanged) {
      appendRendererDiagnostic("messages/render-resource-cleanup", {
        surface: "conversation",
        component: "Messages",
        workspaceId: workspaceId ?? null,
        previousThreadId,
        threadId,
        pendingResourceCounts,
      });
    }
    resourceCleanupThreadIdRef.current = threadId;
    setActiveAnchorId(null);
  }, [
    getPendingInteractionResourceCount,
    getPendingScrollResourceCount,
    getPendingRuntimeResourceCount,
    resetHistoryScope,
    resetInteractionScope,
    threadId,
    workspaceId,
  ]);
  useEffect(() => {
    scrollToAgentTaskCard(agentTaskScrollRequest);
  }, [agentTaskScrollRequest, scrollToAgentTaskCard]);
  useEffect(() => {
    const handleSelectionChange = () => {
      const nextFrozen = isSelectionInsideNode(window.getSelection(), containerRef.current);
      if (nextFrozen) {
        frozenItemsRef.current = frozenItemsRef.current ?? latestItemsRef.current;
      } else {
        frozenItemsRef.current = null;
      }
      setIsSelectionFrozen((previous) => (previous === nextFrozen ? previous : nextFrozen));
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);
  useEffect(() => {
    if (!isSelectionFrozen) {
      frozenItemsRef.current = null;
    }
  }, [isSelectionFrozen, items]);

  useEffect(() => {
    writeLocalBooleanFlag(MESSAGES_LIVE_AUTO_FOLLOW_FLAG_KEY, liveAutoFollowEnabled);
  }, [liveAutoFollowEnabled]);

  useEffect(() => {
    writeLocalBooleanFlag(
      MESSAGES_LIVE_COLLAPSE_MIDDLE_STEPS_FLAG_KEY,
      collapseLiveMiddleStepsEnabled,
    );
  }, [collapseLiveMiddleStepsEnabled]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleLiveControlsUpdated = (
      event: Event,
    ) => {
      const customEvent = event as CustomEvent<{
        liveAutoFollowEnabled?: boolean;
        collapseLiveMiddleStepsEnabled?: boolean;
      }>;
      const detail = customEvent.detail;
      if (!detail) {
        return;
      }
      if (typeof detail.liveAutoFollowEnabled === "boolean") {
        const nextLiveAutoFollowEnabled = detail.liveAutoFollowEnabled;
        const wasLiveAutoFollowEnabled = liveAutoFollowEnabledRef.current;
        if (wasLiveAutoFollowEnabled !== nextLiveAutoFollowEnabled) {
          liveAutoFollowEnabledRef.current = nextLiveAutoFollowEnabled;
          setLiveAutoFollowEnabled(nextLiveAutoFollowEnabled);
        }
        if (!nextLiveAutoFollowEnabled) {
          cancelFocusFollowConvergence();
        }
        if (!wasLiveAutoFollowEnabled && nextLiveAutoFollowEnabled && isWorking) {
          rearmAutoFollowToBottom();
        }
      }
      if (typeof detail.collapseLiveMiddleStepsEnabled === "boolean") {
        const nextCollapseLiveMiddleStepsEnabled = detail.collapseLiveMiddleStepsEnabled;
        if (collapseLiveMiddleStepsEnabledRef.current !== nextCollapseLiveMiddleStepsEnabled) {
          collapseLiveMiddleStepsEnabledRef.current = nextCollapseLiveMiddleStepsEnabled;
          setCollapseLiveMiddleStepsEnabled(nextCollapseLiveMiddleStepsEnabled);
        }
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key) {
        return;
      }
      if (event.key === MESSAGES_LIVE_AUTO_FOLLOW_FLAG_KEY) {
        const nextLiveAutoFollowEnabled = readLocalBooleanFlag(
          MESSAGES_LIVE_AUTO_FOLLOW_FLAG_KEY,
          true,
        );
        if (liveAutoFollowEnabledRef.current !== nextLiveAutoFollowEnabled) {
          liveAutoFollowEnabledRef.current = nextLiveAutoFollowEnabled;
          setLiveAutoFollowEnabled(nextLiveAutoFollowEnabled);
        }
        if (!nextLiveAutoFollowEnabled) {
          cancelFocusFollowConvergence();
        } else if (isWorking) {
          rearmAutoFollowToBottom();
        }
        return;
      }
      if (event.key === MESSAGES_LIVE_COLLAPSE_MIDDLE_STEPS_FLAG_KEY) {
        const nextCollapseLiveMiddleStepsEnabled = readLocalBooleanFlag(
          MESSAGES_LIVE_COLLAPSE_MIDDLE_STEPS_FLAG_KEY,
          false,
        );
        if (collapseLiveMiddleStepsEnabledRef.current !== nextCollapseLiveMiddleStepsEnabled) {
          collapseLiveMiddleStepsEnabledRef.current = nextCollapseLiveMiddleStepsEnabled;
          setCollapseLiveMiddleStepsEnabled(nextCollapseLiveMiddleStepsEnabled);
        }
      }
    };
    window.addEventListener(
      MESSAGES_LIVE_CONTROLS_UPDATED_EVENT,
      handleLiveControlsUpdated as EventListener,
    );
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        MESSAGES_LIVE_CONTROLS_UPDATED_EVENT,
        handleLiveControlsUpdated as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [cancelFocusFollowConvergence, isWorking, rearmAutoFollowToBottom]);
  useEffect(() => {
    if (!liveAutoFollowEnabled || !isWorking) {
      return;
    }
    autoScrollRef.current = true;
    requestAutoScroll();
  }, [autoScrollRef, isWorking, liveAutoFollowEnabled, requestAutoScroll]);
  const reasoningMetaById = useMemo(() => {
    const meta = new Map<string, ReturnType<typeof parseReasoning>>();
    deferredRenderSourceItems.forEach((item) => {
      if (item.kind === "reasoning") {
        meta.set(item.id, parseReasoning(item));
      }
    });
    return meta;
  }, [deferredRenderSourceItems]);

  const lastUserMessageIndex = useMemo(
    () => findLastUserMessageIndex(deferredRenderSourceItems),
    [deferredRenderSourceItems],
  );
  const liveSourceLastUserMessageIndex = useMemo(
    () => findLastUserMessageIndex(renderSourceItems),
    [renderSourceItems],
  );
  const reasoningWindowStartIndex = useMemo(() => {
    if (lastUserMessageIndex >= 0) {
      return lastUserMessageIndex;
    }
    return findLastAssistantMessageIndex(deferredRenderSourceItems);
  }, [deferredRenderSourceItems, lastUserMessageIndex]);
  const liveReasoningWindowStartIndex = useMemo(() => {
    if (liveSourceLastUserMessageIndex >= 0) {
      return liveSourceLastUserMessageIndex;
    }
    return findLastAssistantMessageIndex(renderSourceItems);
  }, [liveSourceLastUserMessageIndex, renderSourceItems]);
  const latestLiveReasoningItem = useMemo(() => {
    if (!isThinking) {
      return null;
    }
    for (
      let index = renderSourceItems.length - 1;
      index > liveReasoningWindowStartIndex;
      index -= 1
    ) {
      const item = renderSourceItems[index];
      if (isReasoningConversationItem(item)) {
        return item;
      }
    }
    return null;
  }, [isThinking, liveReasoningWindowStartIndex, renderSourceItems]);

  const latestReasoningLabel = useMemo(() => {
    if (hideClaudeReasoning) {
      return null;
    }
    if (latestLiveReasoningItem) {
      const parsed = parseReasoning(latestLiveReasoningItem);
      if (parsed.workingLabel) {
        return parsed.workingLabel;
      }
    }
    for (
      let index = deferredRenderSourceItems.length - 1;
      index > reasoningWindowStartIndex;
      index -= 1
    ) {
      const item = deferredRenderSourceItems[index];
      if (!isReasoningConversationItem(item)) {
        continue;
      }
      const parsed = reasoningMetaById.get(item.id);
      if (parsed?.workingLabel) {
        return parsed.workingLabel;
      }
    }
    return null;
  }, [
    deferredRenderSourceItems,
    hideClaudeReasoning,
    latestLiveReasoningItem,
    reasoningMetaById,
    reasoningWindowStartIndex,
  ]);

  const latestDeferredReasoningId = useMemo(() => {
    for (
      let index = deferredRenderSourceItems.length - 1;
      index > reasoningWindowStartIndex;
      index -= 1
    ) {
      const item = deferredRenderSourceItems[index];
      if (isReasoningConversationItem(item)) {
        return item.id;
      }
    }
    return null;
  }, [deferredRenderSourceItems, reasoningWindowStartIndex]);
  const latestReasoningId = latestLiveReasoningItem?.id ?? latestDeferredReasoningId;
  const claudeDockedReasoningItems = useMemo(() => {
    if (!legacyClaudeReasoningDockEnabled) {
      return [] as Array<{
        item: Extract<ConversationItem, { kind: "reasoning" }>;
        parsed: ReturnType<typeof parseReasoning>;
      }>;
    }
    const list: Array<{
      item: Extract<ConversationItem, { kind: "reasoning" }>;
      parsed: ReturnType<typeof parseReasoning>;
    }> = [];
    for (
      let index = reasoningWindowStartIndex + 1;
      index < deferredRenderSourceItems.length;
      index += 1
    ) {
      const item = deferredRenderSourceItems[index];
      if (!isReasoningConversationItem(item)) {
        continue;
      }
      const parsed = reasoningMetaById.get(item.id);
      if (!parsed) {
        continue;
      }
      const hasText =
        Boolean(parsed.bodyText?.trim()) ||
        Boolean(item.content?.trim()) ||
        Boolean(item.summary?.trim());
      if (!hasText) {
        continue;
      }
      list.push({ item, parsed });
    }
    return list;
  }, [
    deferredRenderSourceItems,
    legacyClaudeReasoningDockEnabled,
    reasoningMetaById,
    reasoningWindowStartIndex,
  ]);
  const previousIsThinkingRef = useRef(isThinking);
  useEffect(() => {
    if (previousIsThinkingRef.current && !isThinking && claudeDockedReasoningItems.length > 0) {
      collapseExpandedIds(
        new Set(claudeDockedReasoningItems.map((entry) => entry.item.id)),
      );
    }
    previousIsThinkingRef.current = isThinking;
  }, [claudeDockedReasoningItems, collapseExpandedIds, isThinking]);

  const latestTitleOnlyReasoningId = useMemo(() => {
    for (let index = deferredRenderSourceItems.length - 1; index >= 0; index -= 1) {
      const item = deferredRenderSourceItems[index];
      if (!isReasoningConversationItem(item)) {
        continue;
      }
      const parsed = reasoningMetaById.get(item.id);
      if (parsed?.workingLabel && !parsed.hasBody) {
        return item.id;
      }
    }
    return null;
  }, [deferredRenderSourceItems, reasoningMetaById]);

  const latestWorkingActivityLabel = useMemo(() => {
    let lastUserIndex = -1;
    for (let index = deferredRenderSourceItems.length - 1; index >= 0; index -= 1) {
      const item = deferredRenderSourceItems[index];
      if (isUserMessageConversationItem(item)) {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) {
      return null;
    }
    for (
      let index = deferredRenderSourceItems.length - 1;
      index > lastUserIndex;
      index -= 1
    ) {
      const item = deferredRenderSourceItems[index];
      if (!item) {
        continue;
      }
      if (isAssistantMessageConversationItem(item)) {
        break;
      }
      const label = resolveWorkingActivityLabel(item, activeEngine, presentationProfile);
      if (label) {
        return label;
      }
    }
    return null;
  }, [activeEngine, deferredRenderSourceItems, presentationProfile]);

  const visibleItems = useMemo(
    () =>
      resolveVisibleMessageItems({
        items: deferredRenderSourceItems,
        activeEngine,
        hideClaudeReasoning,
        latestTitleOnlyReasoningId,
        presentationProfile,
        reasoningMetaById,
      }),
    [
      activeEngine,
      deferredRenderSourceItems,
      hideClaudeReasoning,
      latestTitleOnlyReasoningId,
      presentationProfile,
      reasoningMetaById,
    ],
  );
  const timelineSourceItems = useMemo(() => {
    if (activeEngine !== "codex" || !isThinking) {
      return visibleItems;
    }
    return suppressCompletedExploreItemsBetweenLatestUserTurns(visibleItems, {
      enableCollaborationBadge,
    });
  }, [activeEngine, enableCollaborationBadge, isThinking, visibleItems]);
  const { timelineItems, collapsedMiddleStepCount } = useMemo(
    () =>
      resolveCollapsedTimelineItems({
        activeEngine,
        collapseLiveMiddleStepsEnabled,
        isThinking,
        latestAssistantMessageId,
        latestReasoningId,
        timelineSourceItems,
      }),
    [
      activeEngine,
      collapseLiveMiddleStepsEnabled,
      isThinking,
      latestAssistantMessageId,
      latestReasoningId,
      timelineSourceItems,
    ],
  );
  const latestReasoningVisibleInTimeline = useMemo(() => {
    if (!latestReasoningId) {
      return false;
    }
    return timelineItems.some((item) => item.kind === "reasoning" && item.id === latestReasoningId);
  }, [latestReasoningId, timelineItems]);
  const workingIndicatorShowsActivityLabel = shouldDisplayWorkingActivityLabel(
    latestReasoningLabel,
    latestWorkingActivityLabel,
  );
  const workingIndicatorReasoningLabel =
    activeEngine === "claude"
    && latestAssistantMessageId === null
    && workingIndicatorShowsActivityLabel
    && latestReasoningVisibleInTimeline
      ? null
      : latestReasoningLabel;
  useEffect(() => {
    if (activeEngine !== "claude") {
      return;
    }
    logClaudeRender("visible-items", {
      threadId,
      effectiveCount: effectiveItems.length,
      visibleCount: visibleItems.length,
      reasoningIds: visibleItems
        .filter((item) => item.kind === "reasoning")
        .map((item) => item.id),
      assistantIds: visibleItems
        .filter(
          (item): item is Extract<ConversationItem, { kind: "message" }> =>
            item.kind === "message" && item.role === "assistant",
        )
        .map((item) => item.id),
      latestReasoningId,
      latestAssistantMessageId,
      isThinking,
    });
  }, [
    activeEngine,
    effectiveItems.length,
    isThinking,
    latestAssistantMessageId,
    latestReasoningId,
    threadId,
    visibleItems,
  ]);
  const {
    messagesPresentationMode,
    presentationCollapsedHistoryItemCount,
    presentationRenderedItems,
    preservedLatestAssistantTextLength,
    preservedReadableWindowItemCount,
    renderChainBlankingRegressionActive,
    renderedItems,
    shouldUseReadableWindowRecovery,
  } = useMessagesHistoryPresentationWindow({
    activeTurnId,
    blankingRecoveryActive,
    effectiveItemsLength: effectiveItems.length,
    historyExpansionMode,
    isThinking,
    isWorking,
    liveTailWorkingSet,
    readableWindowRecoveryActive,
    showAllHistoryItems,
    supportsStreamingReadableWindowRecovery,
    threadId,
    timelineItems,
    visibleStallRecoveryActive,
    workspaceId,
  });
  const {
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
  } = useMessagesPresentationState({
    activeEngine,
    claudeDockedReasoningItemCount: claudeDockedReasoningItems.length,
    collapsedHistoryItemCount: presentationCollapsedHistoryItemCount,
    deferredRenderSourceItems,
    hideClaudeReasoning,
    historyRestoredAtMs: conversationState.meta.historyRestoredAtMs,
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
    timelineItems,
  });
  useEffect(() => {
    if (!threadId || !isThinking) {
      lastStreamSurfaceDiagnosticKeyRef.current = null;
      return;
    }
    const shouldReportSurface =
      visibleStallRecoveryActive ||
      shouldUseReadableWindowRecovery ||
      renderChainBlankingRegressionActive;
    if (!shouldReportSurface) {
      return;
    }
    const liveAssistantTextLength = liveAssistantItem?.text.length ?? 0;
    const diagnosticKey = [
      threadId,
      activeTurnId ?? "no-turn",
      threadStreamLatencySnapshot?.latencyCategory ?? "no-category",
      renderedItems.length,
      presentationRenderedItems.length,
      timelinePresentationItems.length,
      renderSourceItems.length,
      liveAssistantItem?.id ?? "no-live-assistant",
      liveAssistantTextLength,
      shouldUseReadableWindowRecovery ? "recovery" : "observe",
    ].join(":");
    if (lastStreamSurfaceDiagnosticKeyRef.current === diagnosticKey) {
      return;
    }
    lastStreamSurfaceDiagnosticKeyRef.current = diagnosticKey;
    appendRendererDiagnostic("messages/stream-surface-diagnostic", {
      threadId,
      turnId: activeTurnId,
      engine: activeEngine,
      latencyCategory: threadStreamLatencySnapshot?.latencyCategory ?? null,
      renderedItemsCount: renderedItems.length,
      presentationRenderedItemsCount: presentationRenderedItems.length,
      timelinePresentationItemsCount: timelinePresentationItems.length,
      renderSourceItemsCount: renderSourceItems.length,
      visibleStallRecoveryActive,
      readableWindowRecoveryActive,
      shouldUseReadableWindowRecovery,
      renderChainBlankingRegressionActive,
      liveAssistantItemId: liveAssistantItem?.id ?? null,
      liveAssistantTextLength,
      liveReasoningItemId: liveReasoningItem?.id ?? null,
      preservedReadableWindowItemsCount: preservedReadableWindowItemCount,
      preservedLatestAssistantTextLength,
    });
  }, [
    activeEngine,
    activeTurnId,
    isThinking,
    liveAssistantItem,
    liveReasoningItem,
    preservedLatestAssistantTextLength,
    preservedReadableWindowItemCount,
    presentationRenderedItems.length,
    readableWindowRecoveryActive,
    renderChainBlankingRegressionActive,
    renderSourceItems.length,
    renderedItems.length,
    shouldUseReadableWindowRecovery,
    threadId,
    threadStreamLatencySnapshot?.latencyCategory,
    timelinePresentationItems.length,
    visibleStallRecoveryActive,
  ]);
  const messageAnchors = useMemo(() => {
    const messageItems = timelinePresentationItems.filter(
      (item): item is Extract<ConversationItem, { kind: "message" }> =>
        item.kind === "message" && item.role === "user",
    );
    if (!messageItems.length) {
      return [];
    }
    return messageItems.map((item) => ({
      id: item.id,
      role: item.role,
      title: deriveAnchorTitle(item.text),
    }));
  }, [timelinePresentationItems]);
  const hasAnchorRail = showMessageAnchors && messageAnchors.length > 0;
  const commitActiveAnchorId = useCallback(
    (nextActiveAnchor: string | null, reason: "scroll" | "sync") => {
      const signature = [
        "anchor",
        reason,
        nextActiveAnchor ?? "none",
        messageAnchors.length,
      ].join(":");
      const guard = resolveIdempotentRenderLoopGuard({
        previous: anchorLoopGuardRef.current,
        signature,
        changed: activeAnchorIdRef.current !== nextActiveAnchor,
        now: Date.now(),
      });
      anchorLoopGuardRef.current = guard.nextBudget;
      if (!guard.shouldCommit) {
        if (guard.shouldDiagnose) {
          appendRendererDiagnostic("messages/overlay-loop-guard", {
            surface: "anchor-rail",
            component: "Messages",
            reason,
            threadId,
            workspaceId: workspaceId ?? null,
            rowKind: "message-anchor",
            counter: guard.suppressedCount,
            threshold: "idempotent-state-write",
            anchorCount: messageAnchors.length,
          });
        }
        return;
      }
      activeAnchorIdRef.current = nextActiveAnchor;
      setActiveAnchorId(nextActiveAnchor);
    },
    [messageAnchors.length, threadId, workspaceId],
  );
  const scheduleAnchorUpdate = useCallback(
    (reason: "scroll" | "sync") => {
      if (!hasAnchorRail) {
        return;
      }
      if (anchorUpdateRafRef.current !== null) {
        return;
      }
      anchorUpdateRafRef.current = window.requestAnimationFrame(() => {
        anchorUpdateRafRef.current = null;
        const anchorStartedAt =
          typeof performance === "undefined" ? 0 : performance.now();
        const container = containerRef.current;
        const latestAnchorId = messageAnchors[messageAnchors.length - 1]?.id ?? null;
        const nextActiveAnchor =
          container && isNearBottom(container)
            ? latestAnchorId
            : computeActiveAnchor() ?? latestAnchorId;
        const elapsedMs =
          typeof performance === "undefined"
            ? 0
            : performance.now() - anchorStartedAt;
        if (elapsedMs >= MESSAGES_SLOW_ANCHOR_WARN_MS) {
          logMessagesPerf("anchor.compute", {
            ms: Number(elapsedMs.toFixed(2)),
            reason,
            anchorCount: messageAnchors.length,
            threadId,
          });
        }
        commitActiveAnchorId(nextActiveAnchor, reason);
      });
    },
    [
      commitActiveAnchorId,
      computeActiveAnchor,
      containerRef,
      hasAnchorRail,
      isNearBottom,
      messageAnchors,
      threadId,
    ],
  );
  const handleShowAllHistoryItems = useCallback(() => {
    revealAllHistoryItems("manual");
  }, [revealAllHistoryItems]);
  useLayoutEffect(() => {
    if (!showAllHistoryItems) {
      discardPendingHistoryExpansion();
      return;
    }
    const pendingExpansionMode = consumePendingHistoryExpansionMode();
    const container = containerRef.current;
    if (!pendingExpansionMode || !container) {
      return;
    }
    if (pendingExpansionMode === "manual") {
      autoScrollRef.current = false;
      container.scrollTop = 0;
    }
    scheduleAnchorUpdate("sync");
  }, [
    consumePendingHistoryExpansionMode,
    discardPendingHistoryExpansion,
    autoScrollRef,
    containerRef,
    timelinePresentationItems,
    scheduleAnchorUpdate,
    showAllHistoryItems,
  ]);
  const updateAutoScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const activeProgrammaticEdge = activeProgrammaticScrollEdgeRef.current;
    const activeProgrammaticMotion = activeProgrammaticScrollMotionRef.current;
    if (activeProgrammaticEdge && activeProgrammaticMotion === "smooth") {
      autoScrollRef.current = activeProgrammaticEdge === "bottom";
      scheduleAnchorUpdate("scroll");
      return;
    }
    if (activeProgrammaticEdge) {
      // instant 自动钉底期间，scroll 事件可能是程序化回声：WebKit 异步派发下，钳位
      // /收敛写入产生的事件常在几何继续变化（迟到测高回填）之后才送达，此刻按
      // near-bottom 判定会把布局噪声误判成用户上滚，解除跟随并杀掉收敛 run（发送
      // 消息后跳顶滞留的根因）。只有事件位置命中 run 的读/写指纹才按回声豁免；
      // 未命中说明是真实用户滚动（拖滚动条/触摸等），走下方正常释放语义。
      const eventScrollTop = container.scrollTop;
      const isProgrammaticEcho = programmaticScrollTopEchoRef.current.some(
        (value) =>
          Math.abs(value - eventScrollTop) <= PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX,
      );
      if (isProgrammaticEcho) {
        autoScrollRef.current = activeProgrammaticEdge === "bottom";
        scheduleAnchorUpdate("scroll");
        return;
      }
    }
    // Auto-follow tracks the user's real scroll position: stick to the bottom
    // only while the viewport is actually near the bottom. Scrolling up cancels
    // the follow; scrolling back to the bottom re-enables it.
    const nearBottom = isNearBottom(container);
    autoScrollRef.current = nearBottom;
    if (!nearBottom) {
      cancelScrollConvergence();
    }
    scheduleAnchorUpdate("scroll");
  }, [
    activeProgrammaticScrollEdgeRef,
    activeProgrammaticScrollMotionRef,
    autoScrollRef,
    cancelScrollConvergence,
    containerRef,
    isNearBottom,
    programmaticScrollTopEchoRef,
    scheduleAnchorUpdate,
  ]);
  const clearTransientUiState = useCallback(() => {
    if (anchorUpdateRafRef.current !== null) {
      window.cancelAnimationFrame(anchorUpdateRafRef.current);
      anchorUpdateRafRef.current = null;
    }
    if (planPanelFocusRafRef.current !== null) {
      window.cancelAnimationFrame(planPanelFocusRafRef.current);
      planPanelFocusRafRef.current = null;
    }
    if (planPanelFocusTimeoutRef.current !== null) {
      window.clearTimeout(planPanelFocusTimeoutRef.current);
      planPanelFocusTimeoutRef.current = null;
    }
    if (planPanelFocusNodeRef.current) {
      planPanelFocusNodeRef.current.classList.remove("plan-panel-focus-ring");
      planPanelFocusNodeRef.current = null;
    }
    messageNodeByIdRef.current.clear();
    agentTaskNodeByTaskIdRef.current.clear();
    agentTaskNodeByToolUseIdRef.current.clear();
  }, []);

  useEffect(() => {
    if (!isMessagesPerfDebugEnabled()) {
      return;
    }
    const renderCostMs =
      typeof performance === "undefined"
        ? 0
        : performance.now() - renderStartedAt;
    const previous = lastRenderSnapshotRef.current;
    const changedKeys: string[] = [];
    if (previous) {
      if (previous.items !== effectiveItems) {
        changedKeys.push("items");
      }
      if (previous.userInputRequests !== userInputRequests) {
        changedKeys.push("userInputRequests");
      }
      if (previous.conversationState !== conversationState) {
        changedKeys.push("conversationState");
      }
      if (previous.presentationProfile !== presentationProfile) {
        changedKeys.push("presentationProfile");
      }
      if (previous.isThinking !== isThinking) {
        changedKeys.push("isThinking");
      }
      if (previous.heartbeatPulse !== heartbeatPulse) {
        changedKeys.push("heartbeatPulse");
      }
      if (previous.threadId !== threadId) {
        changedKeys.push("threadId");
      }
    }
    if (
      renderCostMs >= MESSAGES_SLOW_RENDER_WARN_MS ||
      changedKeys.includes("conversationState") ||
      changedKeys.includes("presentationProfile")
    ) {
      logMessagesPerf("render", {
        ms: Number(renderCostMs.toFixed(2)),
        items: effectiveItems.length,
        visibleItems: renderedItems.length,
        anchors: messageAnchors.length,
        threadId,
        changed: changedKeys,
      });
    }
    lastRenderSnapshotRef.current = {
      items: effectiveItems,
      userInputRequests,
      conversationState,
      presentationProfile,
      isThinking,
      heartbeatPulse,
      threadId,
    };
  });

  useEffect(() => {
    if (
      (activeEngine !== "claude" && activeEngine !== "codex" && activeEngine !== "gemini" && activeEngine !== "kimi") ||
      (!isThinking && !isAssistantFinalizing) ||
      !threadId
    ) {
      return;
    }
    noteThreadVisibleRender(threadId, {
      visibleItemCount: renderedItems.length,
    });
  }, [activeEngine, isAssistantFinalizing, isThinking, renderedItems.length, threadId]);

  useEffect(() => clearTransientUiState, [clearTransientUiState]);

  useEffect(() => {
    if (!hasAnchorRail) {
      if (anchorUpdateRafRef.current !== null) {
        window.cancelAnimationFrame(anchorUpdateRafRef.current);
        anchorUpdateRafRef.current = null;
      }
      activeAnchorIdRef.current = null;
      anchorLoopGuardRef.current = DEFAULT_RENDER_LOOP_GUARD_BUDGET;
      setActiveAnchorId((current) => (current === null ? current : null));
      return;
    }
    scheduleAnchorUpdate("sync");
  }, [hasAnchorRail, messageAnchors, scheduleAnchorUpdate, scrollKey, threadId]);

  useEffect(() => {
    if (!liveAutoFollowEnabled || (!isWorking && !isAssistantFinalizing)) {
      return undefined;
    }
    const container = containerRef.current;
    // Follow new content only when the user is parked at the bottom. A manual
    // scroll up flips autoScrollRef off (see updateAutoScroll) and stops the
    // pull-to-bottom; scrolling back down re-arms it.
    const shouldScroll =
      autoScrollRef.current || (container ? isNearBottom(container) : true);
    if (!shouldScroll) {
      return undefined;
    }
    requestAutoScroll();
    return undefined;
  }, [
    autoScrollRef,
    containerRef,
    isAssistantFinalizing,
    isNearBottom,
    isWorking,
    liveAutoFollowEnabled,
    requestAutoScroll,
    scrollKey,
  ]);

  // Opening a thread should land the viewport at the bottom (latest messages),
  // matching chat conventions. Runs once per workspace+thread once history
  // content is actually rendered; live auto-follow and anchor jumps own all
  // subsequent scrolling.
  useLayoutEffect(() => {
    const scope = `${workspaceId ?? ""}\u0000${threadId}`;
    if (initialBottomPinScopeRef.current === scope) {
      return undefined;
    }
    if (isHistoryLoading || timelinePresentationItems.length === 0) {
      return undefined;
    }
    if (pendingJumpMessageId) {
      initialBottomPinScopeRef.current = scope;
      return undefined;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    initialBottomPinScopeRef.current = scope;
    autoScrollRef.current = true;
    stickToBottomIntentRef.current = "history-open";
    stickToBottomDeadlineRef.current = Date.now() + INITIAL_BOTTOM_PIN_BUDGET_MS;
    requestHistoryBottomConvergence();
    // 落位只对此刻的高度有效：虚拟化行还是估算高度、content-visibility:auto 的屏外行
    // 要进视口才真实布局，底部长消息被系统性低估（估高封顶 260px，真实常上千）。
    // 开一个跟随窗口，让下方的内容高度观察器把迟到的测量一路追到底。
  }, [
    autoScrollRef,
    containerRef,
    initialBottomPinScopeRef,
    isHistoryLoading,
    pendingJumpMessageId,
    requestHistoryBottomConvergence,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
    threadId,
    timelinePresentationItems,
    workspaceId,
  ]);

  // 对话结束（isThinking true→false）后开一个收尾跟随窗口：live 尾窗回刷成全量
  // timeline 时几百条历史带着估算高度插进列表，scrollHeight 暴涨；且全量渲染源经
  // useDeferredValue 延后数帧才落地。窗口内的高度变化都由观察器钉回底部。
  useLayoutEffect(() => {
    const wasThinking = settleRepinPrevThinkingRef.current;
    settleRepinPrevThinkingRef.current = isThinking;
    if (wasThinking && !isThinking) {
      if (!liveAutoFollowEnabledRef.current || !autoScrollRef.current) {
        return;
      }
      stickToBottomIntentRef.current = "turn-settle";
      stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
      requestSettleBottomConvergence();
    }
  }, [
    autoScrollRef,
    isThinking,
    requestSettleBottomConvergence,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
  ]);

  // ── 底部跟随的真正驱动：内容高度变化 ───────────────────────────────────
  // 曾经唯一的驱动是依赖 scrollKey 的 auto-follow effect，而 scrollKey 由 items 末条的
  // text.length 算出。正文外部化（liveAssistantTextChannel）之后流式 delta 不再进
  // reducer，items 不变 → scrollKey 不变 → 整个流式期一次都不触发，视口被越长越高的
  // 正文甩在半空，用户每轮都得手动滚到底。虚拟化行的迟到测量、content-visibility 屏外
  // 行进视口才布局也一样：只改高度，不改 items。
  //
  // 所以改由 ResizeObserver 盯住内容盒的真实高度：只要跟随仍 armed（用户 parked 在
  // 底部）且处于跟随窗口（流式中 / 收尾中 / 打开会话的钉底窗口内），就把视口按在底部。
  // 命令式写 scrollTop，不进 state / 不重渲染；空闲期内容不变 → 回调不触发，零开销。
  //
  // 交还控制权走 wheel 而不是只等 scroll：流式期观察器每帧都在写 scrollTop，而 scroll
  // 事件是异步派发的。只靠 updateAutoScroll 的话，一旦某帧的高度变化抢在 scroll 送达
  // 之前，用户刚滚上去就被当场拽回底部——表现是「滚不走」。wheel 在滚动生效前同步到达，
  // 向上滚立即解除跟随；向下滚回底部时由 scroll 的 isNearBottom 重新武装。
  // ponytail: 只覆盖 wheel（桌面主场景）。键盘 PageUp / 触屏拖拽仍靠 scroll 事件滞后一帧
  // 解除，它们不是每帧连续的，不会和高度变化持续抢跑；真要根治得改成 scrollend 语义。
  useEffect(() => {
    const container = containerRef.current;
    const content = container?.querySelector<HTMLElement>(".messages-timeline-root");
    if (!container) {
      return undefined;
    }
    const handleWheel = (event: WheelEvent) => {
      cancelScrollConvergence();
      if (event.deltaY < 0) {
        autoScrollRef.current = false;
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: true });
    if (!content || typeof ResizeObserver === "undefined") {
      return () => container.removeEventListener("wheel", handleWheel);
    }
    const observer = new ResizeObserver(() => {
      // 高度塌缩（虚拟化翻开/live 尾窗裁剪）会让浏览器钳位 scrollTop，这里是钳位后
      // 最早的程序化观察点：先把当前位置吸进指纹环，迟到的钳位 scroll 事件才不会被
      // 误判成用户上滚。
      recordProgrammaticScrollObservation(container.scrollTop);
      if (!autoScrollRef.current) {
        return;
      }
      if (isWorkingRef.current || isAssistantFinalizingRef.current) {
        requestAutoScroll();
        return;
      }
      if (Date.now() > stickToBottomDeadlineRef.current) {
        return;
      }
      if (stickToBottomIntentRef.current === "history-open") {
        requestHistoryBottomConvergence();
      } else if (stickToBottomIntentRef.current === "turn-settle") {
        requestSettleBottomConvergence();
      }
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      container.removeEventListener("wheel", handleWheel);
    };
    // threadId：切会话时重新绑定，避免时间线根节点被换掉后观察到已脱离文档的旧节点。
  }, [
    autoScrollRef,
    cancelScrollConvergence,
    containerRef,
    isAssistantFinalizingRef,
    isWorkingRef,
    recordProgrammaticScrollObservation,
    requestAutoScroll,
    requestHistoryBottomConvergence,
    requestSettleBottomConvergence,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
    threadId,
  ]);

  useEffect(() => {
    if (!isThinking || liveAutoExpandedExploreId !== null) {
      return;
    }
    collapseExploreItems(effectiveItems);
  }, [collapseExploreItems, effectiveItems, isThinking, liveAutoExpandedExploreId]);
  const shouldRenderUserInputNode =
    (activeEngine === "codex" || activeEngine === "claude") &&
    Boolean(legacyOnUserInputSubmit);
  const visibleApprovals = useMemo(() => {
    return getVisibleApprovalsForThread(approvals, workspaceId, threadId);
  }, [approvals, threadId, workspaceId]);
  const hasVisibleUserInputRequest =
    shouldRenderUserInputNode &&
    Boolean(legacyOnUserInputSubmit) &&
    activeUserInputRequestId !== null;
  const approvalNode = useMemo(
    () =>
      visibleApprovals.length > 0 && onApprovalDecision ? (
        <MessagesInlineApproval
          approvals={visibleApprovals}
          workspaces={workspaces}
          onApprovalDecision={onApprovalDecision}
          onApprovalBatchAccept={onApprovalBatchAccept}
          onApprovalRemember={onApprovalRemember}
        />
      ) : null,
    [
      onApprovalBatchAccept,
      onApprovalDecision,
      onApprovalRemember,
      visibleApprovals,
      workspaces,
    ],
  );
  const userInputNode = useMemo(
    () =>
      hasVisibleUserInputRequest ? (
        <MessagesInlineUserInput
          requests={userInputRequests}
          activeThreadId={threadId ?? null}
          activeWorkspaceId={workspaceId ?? null}
          onSubmit={legacyOnUserInputSubmit}
          onDismiss={legacyOnUserInputDismiss}
          shouldRender
        />
      ) : null,
    [
      hasVisibleUserInputRequest,
      legacyOnUserInputDismiss,
      legacyOnUserInputSubmit,
      threadId,
      userInputRequests,
      workspaceId,
    ],
  );
  const timelineHeartbeatPulse =
    (presentationProfile?.heartbeatWaitingHint ?? activeEngine === "opencode")
      ? heartbeatPulse
      : 0;
  const { handlePendingJumpTargetReady, requestScrollToAnchor } =
    useMessagesAnchorNavigation({
      autoScrollRef,
      clearPendingJumpMessage,
      commitActiveAnchorId,
      containerRef,
      messageNodeByIdRef,
      pendingJumpMessageId,
      requestPendingJumpMessage,
      revealAllHistoryItems,
      showAllHistoryItems,
      timelinePresentationSignal: timelinePresentationItems,
    });

  const timelineModels = useMessagesTimelineModels({
    snapshot: {
      assistantFinalBoundarySet,
      assistantLiveTurnFinalBoundarySuppressedSet,
      claudeDockedReasoningItems,
      collapsedMiddleStepCount,
      effectiveItemsCount: timelinePresentationItems.length,
      groupedEntries,
      hasPendingUserTurn: messageActionTargets.hasPendingUserTurn,
      latestFinalAssistantMessageId: messageActionTargets.latestFinalAssistantMessageId,
      messageActionTargetByAssistantId: messageActionTargets.targetByAssistantId,
      messageCopyTextByAssistantId: messageActionTargets.copyTextByAssistantId,
      reasoningMetaById,
      sessionFileChangesSummary,
      suppressedUserMemoryContextMessageIds,
      suppressedUserNoteCardContextMessageIds,
      turnFileChangesByBoundaryId,
      visibleCollapsedHistoryItemCount: presentationCollapsedHistoryItemCount,
    },
    live: {
      heartbeatPulse: timelineHeartbeatPulse,
      hiddenClaudeReasoningOnly,
      isThinking,
      isWorking,
      lastDurationMs,
      latestReasoningId,
      latestReasoningLabel: workingIndicatorReasoningLabel,
      latestWorkingActivityLabel,
      liveAssistantItem,
      liveAssistantMessageId,
      liveReasoningItem,
      primaryWorkingLabel,
      processingStartedAt,
      streamActivityPhase,
      waitingForFirstChunk,
    },
    runtime: {
      activeCollaborationModeId,
      activeEngine,
      activeUserInputAnchorItemId,
      activeUserInputRequestId,
      claudeHistoryTranscriptFallbackActive,
      hasVisibleUserInputRequest,
      historyRecoveryFailureReason,
      isHistoryLoading,
      latestRetryMessage,
      latestRuntimeReconnectItemId,
      proxyEnabled,
      proxyUrl,
      threadId,
      workspaceId,
    },
    navigation: {
      agentTaskNodeByTaskIdRef,
      agentTaskNodeByToolUseIdRef,
      bottomRef,
      messageNodeByIdRef,
      onPendingJumpTargetReady: handlePendingJumpTargetReady,
      pendingJumpMessageId,
      requestAutoScroll,
      requestBottomConvergence: requestTimelineLayoutBottomConvergence,
      scrollElementRef: containerRef,
    },
    interactions: {
      handleCopyMessage,
      handleExitPlanModeExecuteForItem,
      onAssistantVisibleTextRender: handleAssistantVisibleTextRender,
      onConversationDetailHydrationRequest: handleConversationDetailHydrationRequest,
      onConversationLightweightModeEnable: handleConversationLightweightModeEnable,
      onForkFromMessage,
      onOpenDiffPath,
      onOpenNoteCaptureMenu: timelineOpenNoteCaptureMenu,
      onPreviewFileDiff,
      onRecoverThreadRuntime,
      onRecoverThreadRuntimeAndResend,
      onRetryHistory,
      onRewindFromMessage,
      onShowAllHistoryItems: handleShowAllHistoryItems,
      onThreadRecoveryFork,
      openFileLink,
      showFileLinkMenu,
      toggleExpanded,
    },
    presentation: {
      codeBlockCopyUseModifier,
      collapseLiveMiddleStepsEnabled,
      conversationDetailHydrationRequested,
      conversationLightweightModeEnabled,
      copiedMessageId,
      expandedItems,
      historyExpansionActive: showAllHistoryItems,
      liveAutoExpandedExploreId,
      presentationMode: messagesPresentationMode,
      presentationProfile,
      presentationScopeKey,
      selectedExitPlanExecutionByItemKey,
      streamMitigationProfile: activeStreamMitigation,
    },
    slots: { approvalNode, userInputNode },
  });
  return (
    <div
      className={`messages-shell${hasAnchorRail ? " has-anchor-rail" : ""}${enableClaudeRenderSafeMode ? " claude-render-safe" : ""}`}
    >
      <MessagesAnchorRail
        activeAnchorId={activeAnchorId}
        anchors={messageAnchors}
        anchorNavigationLabel={t("messages.anchorNavigation")}
        getFallbackTitle={(index) => t("messages.anchorUserTitle", { index: index + 1 })}
        onScrollToAnchor={requestScrollToAnchor}
      />
      <div
        className="messages scrollable"
        ref={containerRef}
        onScroll={updateAutoScroll}
        onContextMenu={handleConversationContextMenu}
      >
        <MessagesLinkedRunBanner
          taskRuns={taskRuns}
          threadId={threadId}
          workspaceId={workspaceId}
        />
        <MessagesTimeline {...timelineModels} />
      </div>
      <ScrollControl
        containerRef={containerRef}
        onRequestScrollToEdge={handleScrollControlRequest}
      />
      {fileLinkMenu ? (
        <RendererContextMenu
          menu={fileLinkMenu}
          onClose={closeFileLinkMenu}
          className="renderer-context-menu messages-file-link-context-menu"
        />
      ) : null}
      {noteCaptureMenu ? (
        <RendererContextMenu
          menu={noteCaptureMenu}
          onClose={closeNoteCaptureMenu}
          className="renderer-context-menu messages-note-capture-context-menu"
        />
      ) : null}
    </div>
  );
});
