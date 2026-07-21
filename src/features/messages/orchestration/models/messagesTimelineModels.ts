import type {
  MutableRefObject,
  ReactNode,
  RefObject,
} from "react";
import type {
  AccessMode,
  ConversationItem,
  QueuedMessage,
} from "../../../../types";
import type { StreamMitigationProfile } from "../../../threads/utils/streamLatencyDiagnostics";
import type { GroupedEntry } from "../../utils/groupToolItems";
import type { PresentationProfile } from "../../presentation/presentationProfile";
import type { TurnFileChangesSummary } from "../../utils/turnFileChanges";
import type { RuntimeReconnectRecoveryCallbackResult } from "../../utils/recovery/runtimeReconnect";
import type { MessagesPresentationMode } from "../presentation/messagesLiveWindow";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";
import type { parseReasoning } from "../../presentation/messagesReasoning";

type MessageItem = Extract<ConversationItem, { kind: "message" }>;
type ReasoningItem = Extract<ConversationItem, { kind: "reasoning" }>;
type ExitPlanExecutionMode = Extract<AccessMode, "default" | "full-access">;
type RetryMessage = Pick<QueuedMessage, "text" | "images">;

export type TimelineSnapshotModel = {
  assistantFinalBoundarySet: Set<string>;
  assistantLiveTurnFinalBoundarySuppressedSet: Set<string>;
  claudeDockedReasoningItems: Array<{
    item: ReasoningItem;
    parsed: ReturnType<typeof parseReasoning>;
  }>;
  collapsedMiddleStepCount: number;
  effectiveItemsCount: number;
  groupedEntries: GroupedEntry[];
  hasPendingUserTurn: boolean;
  latestFinalAssistantMessageId: string | null;
  messageActionTargetByAssistantId: Map<string, string>;
  messageCopyTextByAssistantId: Map<string, string>;
  reasoningMetaById: Map<string, ReturnType<typeof parseReasoning>>;
  sessionFileChangesSummary: TurnFileChangesSummary | null;
  suppressedUserMemoryContextMessageIds: Set<string>;
  suppressedUserNoteCardContextMessageIds: Set<string>;
  turnFileChangesByBoundaryId: Map<string, TurnFileChangesSummary>;
  visibleCollapsedHistoryItemCount: number;
};

export type TimelineLiveModel = {
  heartbeatPulse: number;
  hiddenClaudeReasoningOnly: boolean;
  isThinking: boolean;
  isWorking: boolean;
  lastDurationMs: number | null;
  latestReasoningId: string | null;
  latestReasoningLabel: string | null;
  latestWorkingActivityLabel: string | null;
  liveAssistantItem: MessageItem | null;
  liveAssistantMessageId: string | null;
  liveReasoningItem: ReasoningItem | null;
  primaryWorkingLabel: string | null;
  processingStartedAt: number | null;
  streamActivityPhase: "idle" | "waiting" | "ingress";
  waitingForFirstChunk: boolean;
};

export type TimelineRuntimeModel = {
  activeCollaborationModeId: string | null;
  activeEngine: MessagesEngine;
  activeUserInputAnchorItemId: string | null;
  activeUserInputRequestId: string | number | null;
  claudeHistoryTranscriptFallbackActive: boolean;
  hasVisibleUserInputRequest: boolean;
  historyRecoveryFailureReason: string | null;
  isHistoryLoading: boolean;
  latestRetryMessage: RetryMessage | null;
  latestRuntimeReconnectItemId: string | null;
  proxyEnabled: boolean;
  proxyUrl: string | null;
  threadId: string | null;
  workspaceId: string | null | undefined;
};

export type TimelineNavigationModel = {
  agentTaskNodeByTaskIdRef: MutableRefObject<Map<string, HTMLDivElement>>;
  agentTaskNodeByToolUseIdRef: MutableRefObject<Map<string, HTMLDivElement>>;
  bottomRef: RefObject<HTMLDivElement | null>;
  messageNodeByIdRef: MutableRefObject<Map<string, HTMLDivElement>>;
  onPendingJumpTargetReady: (messageId: string) => void;
  pendingJumpMessageId: string | null;
  requestAutoScroll: () => void;
  requestBottomConvergence: () => void;
  scrollElementRef: RefObject<HTMLDivElement | null>;
};

export type TimelineInteractionModel = {
  handleCopyMessage: (item: MessageItem, copyText?: string) => void;
  handleExitPlanModeExecuteForItem: (
    itemId: string,
    mode: ExitPlanExecutionMode,
  ) => Promise<void>;
  onAssistantVisibleTextRender?: (payload: {
    itemId: string;
    visibleText: string;
  }) => void;
  onConversationDetailHydrationRequest: () => void;
  onConversationLightweightModeEnable: () => void;
  onForkFromMessage?: (messageId: string) => void;
  onOpenDiffPath?: (path: string) => void;
  onOpenNoteCaptureMenu?: (trigger: HTMLButtonElement) => void;
  onPreviewFileDiff?: (path: string) => void;
  onRecoverThreadRuntime?: (
    workspaceId: string,
    threadId: string,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onRecoverThreadRuntimeAndResend?: (
    workspaceId: string,
    threadId: string,
    message: RetryMessage,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onRetryHistory?: () => void;
  onRewindFromMessage?: (messageId: string) => void;
  onShowAllHistoryItems: () => void;
  onThreadRecoveryFork?: () => Promise<void> | void;
  openFileLink?: (path: string) => void;
  showFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  toggleExpanded: (id: string) => void;
};

export type TimelinePresentationModel = {
  codeBlockCopyUseModifier: boolean;
  collapseLiveMiddleStepsEnabled: boolean;
  conversationDetailHydrationRequested: boolean;
  conversationLightweightModeEnabled: boolean;
  copiedMessageId: string | null;
  expandedItems: Set<string>;
  historyExpansionActive: boolean;
  liveAutoExpandedExploreId: string | null;
  presentationMode: MessagesPresentationMode;
  presentationProfile: PresentationProfile | null;
  presentationScopeKey: string;
  selectedExitPlanExecutionByItemKey: Record<string, ExitPlanExecutionMode>;
  streamMitigationProfile: StreamMitigationProfile | null;
};

export type TimelineSlotsModel = {
  approvalNode: ReactNode | null;
  userInputNode: ReactNode | null;
};

export type MessagesTimelineProps = {
  snapshot: TimelineSnapshotModel;
  live: TimelineLiveModel;
  runtime: TimelineRuntimeModel;
  navigation: TimelineNavigationModel;
  interactions: TimelineInteractionModel;
  presentation: TimelinePresentationModel;
  slots: TimelineSlotsModel;
};
