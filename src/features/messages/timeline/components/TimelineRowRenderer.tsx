import { Fragment, memo, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import NotebookPen from "lucide-react/dist/esm/icons/notebook-pen";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import type { ConversationItem } from "../../../../types";
import { Marker } from "../../../../components/ui/marker";
import { Button } from "../../../../components/ui/button";
import { parseReasoning } from "../../presentation/messagesReasoning";
import { resolveUserMessagePresentation } from "../../presentation/messagesUserPresentation";
import {
  formatCompletedTimeMs,
  shouldHideCodexCanvasCommandCard,
} from "../../utils/messagesRenderUtils";
import type { GroupedEntry } from "../../utils/groupToolItems";
import {
  groupedEntryContainsItemId,
  type TimelineProjectionRow,
} from "../projection/messagesTimelineProjection";
import type { TimelineRowHydrationState } from "../virtualization/messagesTimelineHydration";
import { useTimelineMessageNodeRefs } from "../hooks/useTimelineMessageNodeRefs";
import { resolveTimelineLiveRenderItem } from "../presentation/messagesTimelineLiveRender";
import { resolveTimelineLightweightRowSummary } from "../presentation/messagesTimelineLightweightRow";
import {
  BashToolGroupBlock,
  EditToolGroupBlock,
  ReadToolGroupBlock,
  SearchToolGroupBlock,
  ToolBlockRenderer,
} from "../../components/toolBlocks";
import {
  DiffRow,
  ExploreRow,
  GeneratedImageRow,
  MessageRow,
  ReasoningRow,
  ReviewRow,
  WorkingIndicator,
} from "../../components/MessagesRows";
import { ConversationRowErrorBoundary } from "../../components/conversation/ConversationRowErrorBoundary";
import { TurnFilesChangedCard } from "../../components/conversation/TurnFilesChangedCard";
import type {
  TimelineRowRendererProps,
  TimelineUserActionNodeCacheEntry,
} from "./TimelineRowRenderer.types";

const USER_ACTION_NODE_CACHE_LIMIT = 500;

export const TimelineRowRenderer = memo(function TimelineRowRenderer({
  row,
  hydrationState,
  liveAssistantOutlineReady,
  parseAgentTaskNotification,
  renderLightweight,
  snapshot,
  live,
  runtime,
  navigation,
  interactions,
  presentation,
  slots,
}: TimelineRowRendererProps) {
  const {
    assistantFinalBoundarySet,
    assistantLiveTurnFinalBoundarySuppressedSet,
    claudeDockedReasoningItems,
    effectiveItemsCount,
    hasPendingUserTurn,
    latestFinalAssistantMessageId,
    messageActionTargetByAssistantId,
    messageCopyTextByAssistantId,
    reasoningMetaById,
    suppressedUserMemoryContextMessageIds,
    suppressedUserNoteCardContextMessageIds,
    turnFileChangesByBoundaryId,
  } = snapshot;
  const {
    heartbeatPulse,
    isThinking,
    isWorking,
    lastDurationMs,
    latestReasoningId,
    latestReasoningLabel,
    latestWorkingActivityLabel,
    liveAssistantItem,
    liveAssistantMessageId,
    liveReasoningItem,
    primaryWorkingLabel,
    processingStartedAt,
    streamActivityPhase,
    waitingForFirstChunk,
  } = live;
  const {
    activeCollaborationModeId,
    activeEngine,
    activeUserInputAnchorItemId,
    activeUserInputRequestId,
    claudeHistoryTranscriptFallbackActive,
    latestRetryMessage,
    latestRuntimeReconnectItemId,
    proxyEnabled,
    proxyUrl,
    threadId,
    workspaceId,
  } = runtime;
  const {
    agentTaskNodeByTaskIdRef,
    agentTaskNodeByToolUseIdRef,
    messageNodeByIdRef,
    requestAutoScroll,
  } = navigation;
  const {
    handleCopyMessage,
    handleExitPlanModeExecuteForItem,
    onAssistantVisibleTextRender,
    onConversationDetailHydrationRequest,
    onForkFromMessage,
    onOpenDiffPath,
    onOpenNoteCaptureMenu,
    onPreviewFileDiff,
    onRecoverThreadRuntime,
    onRecoverThreadRuntimeAndResend,
    onRetryHistory,
    onRewindFromMessage,
    onThreadRecoveryFork,
    openFileLink,
    showFileLinkMenu,
    toggleExpanded,
  } = interactions;
  const {
    codeBlockCopyUseModifier,
    copiedMessageId,
    expandedItems,
    liveAutoExpandedExploreId,
    presentationProfile,
    selectedExitPlanExecutionByItemKey,
    streamMitigationProfile,
  } = presentation;
  const { approvalNode, userInputNode } = slots;
  const { t } = useTranslation();
  const messageNodeRefs = useTimelineMessageNodeRefs({
    agentTaskNodeByTaskIdRef,
    agentTaskNodeByToolUseIdRef,
    messageNodeByIdRef,
  });
  const dockedReasoningById = useMemo(
    () => new Map(claudeDockedReasoningItems.map((entry) => [entry.item.id, entry])),
    [claudeDockedReasoningItems],
  );
  // MessageRow 的 memo 比较器按引用比对 userActionNode；若每次时间线渲染都新建
  // 元素，所有用户行都会被打穿并真实重渲染（流式期间每个 token 一次）。按行缓存
  // 元素，仅在影响输出的输入（item 引用 / 复制文案 / 已复制态 / 语言）变化时重建。
  const userActionNodeCacheRef = useRef(
    new Map<string, TimelineUserActionNodeCacheEntry>(),
  );
  const renderSingleItem = (item: ConversationItem) => {
    const renderItem = resolveTimelineLiveRenderItem(
      item,
      liveAssistantItem,
      liveReasoningItem,
    );
    const renderKind = renderItem.kind;
    if (renderKind === "message" && renderItem.kind === "message") {
      const itemRenderKey = `message:${renderItem.id}`;
      const isCopied = copiedMessageId === renderItem.id;
      const agentTaskNotification = parseAgentTaskNotification(renderItem.text);
      const shouldRenderFinalBoundary =
        renderItem.role === "assistant" &&
        renderItem.isFinal === true &&
        assistantFinalBoundarySet.has(renderItem.id) &&
        !assistantLiveTurnFinalBoundarySuppressedSet.has(renderItem.id);
      // 空闲时最后一轮的汇总由时间线末尾的会话累计卡承载，内联卡只回溯更早轮次；
      // 一旦有新回合进行中（hasPendingUserTurn），末尾累计卡会落到新问题之后，
      // 此时改由这一轮的内联卡把汇总钉在它自己的回合边界上。
      const turnFilesChangedSummary =
        shouldRenderFinalBoundary &&
        (renderItem.id !== latestFinalAssistantMessageId || hasPendingUserTurn)
          ? turnFileChangesByBoundaryId.get(renderItem.id) ?? null
          : null;
      const finalMetaParts: string[] = [];
      if (typeof renderItem.finalCompletedAt === "number" && renderItem.finalCompletedAt > 0) {
        finalMetaParts.push(formatCompletedTimeMs(renderItem.finalCompletedAt));
      }
      const finalMetaText = finalMetaParts.join(" · ");
      const actionTargetUserMessageId =
        renderItem.role === "assistant"
          ? messageActionTargetByAssistantId.get(renderItem.id) ?? null
          : null;
      const isLatestFinalAssistant =
        renderItem.id === latestFinalAssistantMessageId;
      const shouldRenderAssistantActions =
        renderItem.role === "assistant" && renderItem.isFinal === true;
      const assistantCopyText =
        renderItem.role === "assistant"
          ? messageCopyTextByAssistantId.get(renderItem.id) ?? renderItem.text
          : renderItem.text;
      const userCopyText =
        renderItem.role === "user"
          ? resolveUserMessagePresentation({
              text: renderItem.text,
              selectedAgentName: renderItem.selectedAgentName,
              selectedAgentIcon: renderItem.selectedAgentIcon,
              enableCollaborationBadge: activeEngine === "codex",
            }).displayText
          : "";
      const shouldRenderUserActions =
        renderItem.role === "user" && userCopyText.trim().length > 0;
      const shouldRenderForkAction =
        isLatestFinalAssistant &&
        Boolean(actionTargetUserMessageId) &&
        typeof onForkFromMessage === "function";
      const shouldRenderRewindAction =
        isLatestFinalAssistant &&
        Boolean(actionTargetUserMessageId) &&
        typeof onRewindFromMessage === "function";
      const renderAssistantActions = () => {
        if (!shouldRenderAssistantActions) {
          return null;
        }
        return (
          <div
            className="message-action-bar message-action-bar-row"
            aria-label={t("messages.messageActions")}
          >
            {isLatestFinalAssistant && onOpenNoteCaptureMenu ? (
              <button
                type="button"
                className="ghost message-action-button"
                onClick={(event) => onOpenNoteCaptureMenu(event.currentTarget)}
                aria-label={t("noteCards.captureMenu")}
                title={t("noteCards.captureMenu")}
              >
                <NotebookPen size={9} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className={`ghost message-action-button message-copy-button${isCopied ? " is-copied" : ""}`}
              onClick={() => handleCopyMessage(renderItem, assistantCopyText)}
              aria-label={t("messages.copyMessage")}
              title={t("messages.copyMessage")}
            >
              <span className="message-copy-icon" aria-hidden>
                <Copy className="message-copy-icon-copy" size={12} />
                <Check className="message-copy-icon-check" size={12} />
              </span>
            </button>
            {shouldRenderForkAction && actionTargetUserMessageId ? (
              <button
                type="button"
                className="ghost message-action-button"
                onClick={() => onForkFromMessage(actionTargetUserMessageId)}
                aria-label={t("messages.forkMessage")}
                title={t("messages.forkMessage")}
              >
                <span className="codicon codicon-git-branch-create" aria-hidden />
              </button>
            ) : null}
            {shouldRenderRewindAction && actionTargetUserMessageId ? (
              <button
                type="button"
                className="ghost message-action-button"
                onClick={() => onRewindFromMessage(actionTargetUserMessageId)}
                aria-label={t("messages.rewindMessage")}
                title={t("messages.rewindMessage")}
              >
                <span
                  className="codicon codicon-history message-history-icon"
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
        );
      };
      const renderUserActions = () => {
        if (!shouldRenderUserActions) {
          return null;
        }
        const cache = userActionNodeCacheRef.current;
        const cached = cache.get(renderItem.id);
        if (
          cached &&
          cached.item === renderItem &&
          cached.copyText === userCopyText &&
          cached.isCopied === isCopied &&
          cached.translate === t
        ) {
          return cached.node;
        }
        const node = (
          <div
            className="message-action-bar message-user-bubble-actions"
            aria-label={t("messages.messageActions")}
          >
            <button
              type="button"
              className={`ghost message-action-button message-copy-button${isCopied ? " is-copied" : ""}`}
              onClick={() => handleCopyMessage(renderItem, userCopyText)}
              aria-label={t("messages.copyUserMessage")}
              title={t("messages.copyUserMessage")}
            >
              <span className="message-copy-icon" aria-hidden>
                <Copy className="message-copy-icon-copy" size={12} />
                <Check className="message-copy-icon-check" size={12} />
              </span>
            </button>
          </div>
        );
        if (cache.size >= USER_ACTION_NODE_CACHE_LIMIT) {
          cache.clear();
        }
        cache.set(renderItem.id, {
          item: renderItem,
          copyText: userCopyText,
          isCopied,
          translate: t,
          node,
        });
        return node;
      };
      const bindMessageNode = messageNodeRefs.getRef(renderItem.id, {
        role: renderItem.role,
        taskId: agentTaskNotification?.taskId ?? null,
        toolUseId: agentTaskNotification?.toolUseId ?? null,
      });
      return (
        <Fragment key={itemRenderKey}>
          <div
            ref={bindMessageNode}
            data-message-anchor-id={renderItem.id}
            data-agent-task-id={agentTaskNotification?.taskId ?? undefined}
            data-agent-tool-use-id={agentTaskNotification?.toolUseId ?? undefined}
          >
            <MessageRow
              item={renderItem}
              workspaceId={workspaceId}
              threadId={threadId}
              isStreaming={
                (activeEngine === "claude" ||
                  activeEngine === "codex" ||
                  activeEngine === "gemini" ||
                  activeEngine === "kimi") &&
                renderItem.role === "assistant" &&
                renderItem.recoveredFromLiveShadow !== true &&
                renderItem.id === liveAssistantMessageId
              }
              activeEngine={activeEngine}
              activeCollaborationModeId={activeCollaborationModeId}
              enableCollaborationBadge={activeEngine === "codex"}
              presentationProfile={presentationProfile}
              showRuntimeReconnectCard={renderItem.id === latestRuntimeReconnectItemId}
              onRecoverThreadRuntime={onRecoverThreadRuntime}
              onRecoverThreadRuntimeAndResend={onRecoverThreadRuntimeAndResend}
              onThreadRecoveryFork={onThreadRecoveryFork}
              retryMessage={
                renderItem.id === latestRuntimeReconnectItemId
                  ? latestRetryMessage
                  : null
              }
              userActionNode={renderUserActions()}
              codeBlockCopyUseModifier={codeBlockCopyUseModifier}
              onOpenFileLink={openFileLink}
              onOpenFileLinkMenu={showFileLinkMenu}
              streamMitigationProfile={streamMitigationProfile}
              onAssistantVisibleTextRender={onAssistantVisibleTextRender}
              suppressMemorySummaryCard={suppressedUserMemoryContextMessageIds.has(renderItem.id)}
              suppressNoteCardSummaryCard={suppressedUserNoteCardContextMessageIds.has(renderItem.id)}
              onOutlineReady={
                renderItem.role === "assistant" && renderItem.id === liveAssistantMessageId
                  ? liveAssistantOutlineReady
                  : undefined
              }
            />
          </div>
          {turnFilesChangedSummary && (
            <TurnFilesChangedCard
              summary={turnFilesChangedSummary}
              onPreviewFileDiff={onPreviewFileDiff}
            />
          )}
          {shouldRenderFinalBoundary && (
            <Marker
              variant="separator"
              role="separator"
              className="messages-turn-boundary messages-final-boundary"
            >
              <span className="messages-turn-boundary-label">
                <span className="messages-turn-boundary-label-content">
                  {t("messages.finalMessageBoundary")}
                </span>
              </span>
              {finalMetaText && (
                <span className="messages-turn-boundary-meta">{finalMetaText}</span>
              )}
              {renderAssistantActions()}
            </Marker>
          )}
        </Fragment>
      );
    }
    if (renderKind === "reasoning" && renderItem.kind === "reasoning") {
      const itemRenderKey = `reasoning:${renderItem.id}`;
      const isExpanded = expandedItems.has(renderItem.id);
      const parsed = reasoningMetaById.get(renderItem.id) ?? parseReasoning(renderItem);
      const isLiveReasoning =
        isThinking && latestReasoningId === renderItem.id;
      return (
        <ReasoningRow
          key={itemRenderKey}
          item={renderItem}
          workspaceId={workspaceId}
          parsed={parsed}
          isExpanded={isExpanded}
          isLive={isLiveReasoning}
          activeEngine={activeEngine}
          onToggle={toggleExpanded}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
          presentationProfile={presentationProfile}
          streamMitigationProfile={streamMitigationProfile}
        />
      );
    }
    if (renderKind === "review" && renderItem.kind === "review") {
      return (
        <ReviewRow
          key={`review:${renderItem.id}`}
          item={renderItem}
          workspaceId={workspaceId}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
        />
      );
    }
    if (renderKind === "generatedImage" && renderItem.kind === "generatedImage") {
      return (
        <GeneratedImageRow
          key={`generated-image:${renderItem.id}`}
          item={renderItem}
          workspaceId={workspaceId}
        />
      );
    }
    if (renderKind === "diff" && renderItem.kind === "diff") {
      return <DiffRow key={`diff:${renderItem.id}`} item={renderItem} />;
    }
    if (renderKind === "tool" && renderItem.kind === "tool") {
      if (shouldHideCodexCanvasCommandCard(renderItem, activeEngine)) {
        return null;
      }
      const isExpanded = expandedItems.has(renderItem.id);
      const selectedExitPlanExecutionMode =
        selectedExitPlanExecutionByItemKey[`${threadId ?? "no-thread"}:${renderItem.id}`] ?? null;
      return (
        <div key={`tool:${renderItem.id}`} className="message-tool-block-shell">
          <ToolBlockRenderer
            item={renderItem}
            workspaceId={workspaceId}
            isExpanded={isExpanded}
            onToggle={toggleExpanded}
            onRequestAutoScroll={requestAutoScroll}
            activeCollaborationModeId={activeCollaborationModeId}
            activeEngine={activeEngine}
            hasPendingUserInputRequest={activeUserInputRequestId !== null}
            onOpenDiffPath={onOpenDiffPath}
            selectedExitPlanExecutionMode={selectedExitPlanExecutionMode}
            onExitPlanModeExecute={handleExitPlanModeExecuteForItem}
          />
        </div>
      );
    }
    if (renderKind === "explore" && renderItem.kind === "explore") {
      const isExpanded =
        liveAutoExpandedExploreId === renderItem.id || expandedItems.has(renderItem.id);
      return (
        <ExploreRow
          key={`explore:${renderItem.id}`}
          item={renderItem}
          isExpanded={isExpanded}
          onToggle={toggleExpanded}
        />
      );
    }
    return null;
  };

  const renderEntry = (entry: GroupedEntry) => {
    const shouldRenderUserInputAfterEntry = Boolean(
      userInputNode &&
        activeUserInputAnchorItemId &&
        groupedEntryContainsItemId(entry, activeUserInputAnchorItemId),
    );
    const renderWithAnchoredUserInput = (node: ReactNode) => {
      if (!shouldRenderUserInputAfterEntry) {
        return node;
      }
      return (
        <Fragment key={`user-input-anchor:${activeUserInputAnchorItemId}`}>
          {node}
          {userInputNode}
        </Fragment>
      );
    };
    if (entry.kind === "readGroup") {
      const firstItem = entry.items[0];
      return renderWithAnchoredUserInput(
        <ReadToolGroupBlock key={`rg-${firstItem?.id ?? "read-group"}`} items={entry.items} />,
      );
    }
    if (entry.kind === "editGroup") {
      const firstItem = entry.items[0];
      return renderWithAnchoredUserInput(
        <EditToolGroupBlock
          key={`eg-${firstItem?.id ?? "edit-group"}`}
          items={entry.items}
          onOpenDiffPath={onOpenDiffPath}
        />,
      );
    }
    if (entry.kind === "bashGroup") {
      if (
        activeEngine === "codex" ||
        (activeEngine === "claude" && !claudeHistoryTranscriptFallbackActive)
      ) {
        return null;
      }
      const firstItem = entry.items[0];
      return renderWithAnchoredUserInput(
        <BashToolGroupBlock
          key={`bg-${firstItem?.id ?? "bash-group"}`}
          items={entry.items}
          onRequestAutoScroll={requestAutoScroll}
        />,
      );
    }
    if (entry.kind === "searchGroup") {
      const firstItem = entry.items[0];
      return renderWithAnchoredUserInput(
        <SearchToolGroupBlock key={`sg-${firstItem?.id ?? "search-group"}`} items={entry.items} />,
      );
    }
    return renderWithAnchoredUserInput(renderSingleItem(entry.item));
  };
  const renderLightweightProjectionRow = (
    row: TimelineProjectionRow,
    hydrationState: TimelineRowHydrationState,
  ) => {
    const { itemCount, rowKindLabel, singleMessage } = resolveTimelineLightweightRowSummary(
      row,
      {
        assistantMessage: t("messages.conversationLightweightAssistantMessage"),
        userMessage: t("messages.conversationLightweightUserMessage"),
      },
    );
    const actionTargetUserMessageId =
      singleMessage?.role === "assistant"
        ? messageActionTargetByAssistantId.get(singleMessage.id) ?? null
        : null;
    const shouldRenderForkAction =
      singleMessage?.id === latestFinalAssistantMessageId &&
      Boolean(actionTargetUserMessageId) &&
      typeof onForkFromMessage === "function";
    const shouldRenderRewindAction =
      singleMessage?.id === latestFinalAssistantMessageId &&
      Boolean(actionTargetUserMessageId) &&
      typeof onRewindFromMessage === "function";
    const bindLightweightMessageNode = singleMessage
      ? messageNodeRefs.getRef(singleMessage.id, {
          role: singleMessage.role,
          taskId: null,
          toolUseId: null,
        })
      : undefined;

    return (
      <div
        ref={bindLightweightMessageNode}
        className="messages-lightweight-row-summary"
        data-conversation-lightweight-row="true"
        data-message-anchor-id={singleMessage?.id}
      >
        <div className="messages-lightweight-row-summary-main">
          <span className="messages-lightweight-row-summary-eyebrow">
            {t("messages.conversationLightweightRowEyebrow")}
          </span>
          <strong>
            {t("messages.conversationLightweightRowTitle", {
              kind: rowKindLabel,
              count: itemCount,
            })}
          </strong>
          <span>
            {t("messages.conversationLightweightRowMeta", {
              weight: hydrationState.renderWeight,
            })}
          </span>
        </div>
        <div className="messages-lightweight-row-summary-actions">
          {shouldRenderForkAction && actionTargetUserMessageId ? (
            <button
              type="button"
              className="ghost message-action-button"
              onClick={() => onForkFromMessage(actionTargetUserMessageId)}
              aria-label={t("messages.forkMessage")}
              title={t("messages.forkMessage")}
            >
              <span className="codicon codicon-git-branch-create" aria-hidden />
            </button>
          ) : null}
          {shouldRenderRewindAction && actionTargetUserMessageId ? (
            <button
              type="button"
              className="ghost message-action-button"
              onClick={() => onRewindFromMessage(actionTargetUserMessageId)}
              aria-label={t("messages.rewindMessage")}
              title={t("messages.rewindMessage")}
            >
              <span className="codicon codicon-history" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="messages-lightweight-row-detail-button"
            onClick={onConversationDetailHydrationRequest}
          >
            {t("messages.conversationLightweightHydrateVisible")}
          </button>
        </div>
      </div>
    );
  };
  const renderProjectionRow = (row: TimelineProjectionRow | undefined) => {
    if (!row) {
      return null;
    }
    if (row.kind === "entry") {
      return renderEntry(row.entry);
    }
    if (row.kind === "dockedReasoning") {
      const dockedReasoning = dockedReasoningById.get(row.itemId);
      if (!dockedReasoning) {
        return null;
      }
      const { item, parsed } = dockedReasoning;
      return (
        <ReasoningRow
          key={`claude-live-${item.id}`}
          item={item}
          workspaceId={workspaceId}
          parsed={parsed}
          isExpanded={isThinking && latestReasoningId === item.id ? true : expandedItems.has(item.id)}
          isLive={isThinking && latestReasoningId === item.id}
          onToggle={toggleExpanded}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
          presentationProfile={presentationProfile}
          streamMitigationProfile={streamMitigationProfile}
        />
      );
    }
    if (row.kind === "tailUserInput") {
      return userInputNode;
    }
    if (row.kind === "liveMiddleCollapsed") {
      return (
        <div className="messages-live-middle-collapsed-indicator" role="status">
          {t("messages.middleStepsCollapsedHint", { count: row.count })}
        </div>
      );
    }
    if (row.kind === "workingIndicator") {
      return (
        <WorkingIndicator
          isThinking={isWorking}
          proxyEnabled={proxyEnabled}
          proxyUrl={proxyUrl}
          processingStartedAt={processingStartedAt}
          lastDurationMs={lastDurationMs}
          heartbeatPulse={heartbeatPulse}
          hasItems={effectiveItemsCount > 0}
          reasoningLabel={latestReasoningLabel}
          activityLabel={latestWorkingActivityLabel}
          primaryLabel={primaryWorkingLabel}
          activeEngine={activeEngine}
          waitingForFirstChunk={waitingForFirstChunk}
          presentationProfile={presentationProfile}
          streamActivityPhase={streamActivityPhase}
        />
      );
    }
    if (row.kind === "historyRecoveryFailure") {
      return (
        <div
          className="message-runtime-recovery-card"
          role="alert"
          aria-label={t("messages.threadRecoveryTitle")}
        >
          <div className="message-runtime-recovery-header">
            <Terminal className="message-runtime-recovery-icon" size={15} aria-hidden />
            <div className="message-runtime-recovery-copy">
              <div className="message-runtime-recovery-title">
                {t("messages.threadRecoveryTitle")}
              </div>
              <div className="message-runtime-recovery-description">
                {t("messages.threadRecoveryFailed")}
              </div>
            </div>
            {onRetryHistory ? (
              <div className="message-runtime-recovery-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="message-runtime-recovery-button"
                  onClick={onRetryHistory}
                >
                  {t("messages.threadRecoveryAction")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    if (row.kind === "emptyState") {
      if (row.state === "historyLoading") {
        return (
          <div
            className="empty messages-empty messages-history-loading"
            role="status"
            aria-live="polite"
          >
            <span className="working-spinner" aria-hidden="true" />
            <div className="messages-history-loading-copy">
              <strong>{t("messages.restoringHistory")}</strong>
              <span>{t("messages.restoringHistoryHint")}</span>
            </div>
          </div>
        );
      }
      if (row.state === "hiddenReasoning") {
        return (
          <div className="empty messages-empty messages-hidden-reasoning">
            {t("messages.hiddenThinkingContent")}
          </div>
        );
      }
      return <div className="empty messages-empty">{t("messages.emptyThread")}</div>;
    }
    if (row.kind === "approval") {
      return approvalNode;
    }
    if (row.kind === "bottomAnchor") {
      return null;
    }
    return null;
  };
  return (
    <ConversationRowErrorBoundary
      key={`row-boundary:${row.key}:${hydrationState?.contentHash ?? "unknown"}`}
      rowKey={row.key}
      rowKind={row.kind}
      contentHash={hydrationState?.contentHash ?? null}
      renderWeight={hydrationState?.renderWeight ?? null}
      engine={activeEngine}
      threadId={threadId}
      workspaceId={workspaceId ?? null}
      fallbackTitle={t("messages.rowRenderFailedTitle")}
      fallbackDescription={t("messages.rowRenderFailedDescription")}
      retryLabel={t("messages.rowRenderRetry")}
      retryBlockedLabel={t("messages.rowRenderRetryBlocked")}
    >
      {renderLightweight && hydrationState
        ? renderLightweightProjectionRow(row, hydrationState)
        : renderProjectionRow(row)}
    </ConversationRowErrorBoundary>
  );
});
