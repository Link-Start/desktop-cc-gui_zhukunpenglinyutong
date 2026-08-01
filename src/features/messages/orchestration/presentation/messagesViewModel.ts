import type { ConversationItem, RequestUserInputRequest } from "../../../../types";
import type { PresentationProfile } from "../../../../conversation-presentation/presentationProfile";
import { shouldHideToolItemForRender } from "../../utils/groupToolItems";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";
import {
  countRenderableCollapsedEntries,
  scrollKeyForItems,
  toConversationEngine,
} from "../../utils/messagesRenderUtils";
import {
  collapseConsecutiveReasoningRuns,
  dedupeAdjacentReasoningItems,
  isExplicitReasoningSegmentId,
  parseReasoning,
} from "../../presentation/messagesReasoning";

export type MessageActionTargets = {
  targetByAssistantId: Map<string, string>;
  copyTextByAssistantId: Map<string, string>;
  latestFinalAssistantMessageId: string | null;
  // 最近一条用户消息之后尚无最终回复 = 有新回合正在进行中。
  hasPendingUserTurn: boolean;
  userMessageCount: number;
};

export type HistoryExpansionScrollSnapshot = {
  scrollHeight: number;
  scrollTop: number;
};

export type PreservedReadableWindow = {
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  renderedItems: ConversationItem[];
  visibleCollapsedHistoryItemCount: number;
};

/**
 * One causal process phase: the contiguous tool/reasoning/explore run that
 * immediately precedes an assistant prose message.
 *
 * Timeline shape:
 *   user → [process…] → assistant text A → [process…] → assistant text B → [open process…]
 * Each completed process run becomes a drawer:
 *   [header chip] → [process body…] → assistant text
 */
export type ProcessPhaseBreakdown = {
  reasoningCount: number;
  toolCount: number;
  exploreCount: number;
};

export type ProcessPhaseCollapse = {
  phaseKey: string;
  assistantItemId: string;
  /**
   * Insert the drawer header immediately before this process item
   * (first tool/reasoning/explore of the phase) so collapse stays at the top.
   */
  insertBeforeItemId: string;
  count: number;
  breakdown: ProcessPhaseBreakdown;
  durationMs: number | null;
  expanded: boolean;
  hiddenItemIds: readonly string[];
};

export type CollapsedTimelineItemsResult = {
  timelineItems: ConversationItem[];
  phases: ProcessPhaseCollapse[];
};

function emptyCollapsedTimelineResult(
  timelineSourceItems: ConversationItem[],
): CollapsedTimelineItemsResult {
  return {
    timelineItems: timelineSourceItems,
    phases: [],
  };
}

function isAssistantMessageWithVisibleText(item: ConversationItem): boolean {
  return (
    item.kind === "message" &&
    item.role === "assistant" &&
    item.text.trim().length > 0
  );
}

/** Process items that can form a causal phase above assistant prose. */
function isCollapsibleProcessItem(item: ConversationItem): boolean {
  return (
    item.kind === "tool" ||
    item.kind === "reasoning" ||
    item.kind === "explore"
  );
}

function resolvePhaseDurationMs(items: readonly ConversationItem[]): number | null {
  let total = 0;
  let hasDuration = false;
  for (const item of items) {
    if (item.kind === "tool" && typeof item.durationMs === "number" && item.durationMs >= 0) {
      total += item.durationMs;
      hasDuration = true;
    }
  }
  return hasDuration ? total : null;
}

function resolvePhaseBreakdown(items: readonly ConversationItem[]): ProcessPhaseBreakdown {
  let reasoningCount = 0;
  let toolCount = 0;
  let exploreCount = 0;
  for (const item of items) {
    if (item.kind === "reasoning") {
      reasoningCount += 1;
    } else if (item.kind === "tool") {
      toolCount += 1;
    } else if (item.kind === "explore") {
      exploreCount += 1;
    }
  }
  return { reasoningCount, toolCount, exploreCount };
}

export function findItemById(items: ConversationItem[], itemId: string | null) {
  if (!itemId) {
    return null;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.id === itemId) {
      return item;
    }
  }
  return null;
}

export function readHistoryExpansionScrollSnapshot(
  container: HTMLDivElement | null,
): HistoryExpansionScrollSnapshot | null {
  if (!container) {
    return null;
  }
  const { scrollHeight, scrollTop } = container;
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(scrollTop)) {
    return null;
  }
  return { scrollHeight, scrollTop };
}

export function restoreHistoryExpansionScrollPosition(
  container: HTMLDivElement,
  snapshot: HistoryExpansionScrollSnapshot,
) {
  const currentScrollHeight = container.scrollHeight;
  if (!Number.isFinite(currentScrollHeight)) {
    return false;
  }
  const scrollHeightDelta = currentScrollHeight - snapshot.scrollHeight;
  const nextScrollTop = snapshot.scrollTop + scrollHeightDelta;
  if (!Number.isFinite(nextScrollTop)) {
    return false;
  }
  container.scrollTop = Math.max(0, nextScrollTop);
  return true;
}

export function findLatestAssistantTextLength(items: ConversationItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || item.kind !== "message" || item.role !== "assistant") {
      continue;
    }
    return item.text.length;
  }
  return 0;
}

export function mergeReadableRecoveryItems(
  preservedItems: ConversationItem[],
  currentItems: ConversationItem[],
) {
  if (currentItems.length === 0) {
    return preservedItems;
  }
  const preservedItemIds = new Set(preservedItems.map((item) => item.id));
  const appendedCurrentItems = currentItems.filter((item) => !preservedItemIds.has(item.id));
  return appendedCurrentItems.length > 0
    ? [...preservedItems, ...appendedCurrentItems]
    : preservedItems;
}

export function buildMessageActionTargets(items: ConversationItem[]): MessageActionTargets {
  const targetByAssistantId = new Map<string, string>();
  const copyTextByAssistantId = new Map<string, string>();
  let latestUserMessageId: string | null = null;
  let latestFinalAssistantMessageId: string | null = null;
  let hasPendingUserTurn = false;
  let userMessageCount = 0;
  let assistantTurnTextParts: string[] = [];
  for (const item of items) {
    if (item.kind !== "message") {
      continue;
    }
    if (item.role === "user") {
      userMessageCount += 1;
      latestUserMessageId = item.id;
      hasPendingUserTurn = true;
      assistantTurnTextParts = [];
      continue;
    }
    if (item.role !== "assistant") {
      continue;
    }
    if (latestUserMessageId) {
      targetByAssistantId.set(item.id, latestUserMessageId);
    }
    assistantTurnTextParts.push(item.text);
    if (item.isFinal === true) {
      latestFinalAssistantMessageId = item.id;
      hasPendingUserTurn = false;
      copyTextByAssistantId.set(item.id, assistantTurnTextParts.join("\n\n"));
      assistantTurnTextParts = [];
    }
  }
  return {
    targetByAssistantId,
    copyTextByAssistantId,
    latestFinalAssistantMessageId,
    hasPendingUserTurn,
    userMessageCount,
  };
}

export function resolveActiveUserInputRequest(options: {
  requests: RequestUserInputRequest[];
  threadId: string | null;
  workspaceId: string | null | undefined;
}) {
  const { requests, threadId, workspaceId } = options;
  if (!threadId || requests.length === 0) {
    return null;
  }
  return requests.find(
    (request) =>
      request.params.thread_id === threadId &&
      (!workspaceId || request.workspace_id === workspaceId),
  ) ?? null;
}

export function buildMessagesScrollKey(
  items: ConversationItem[],
  activeUserInputRequestId: string | number | null,
) {
  return `${scrollKeyForItems(items)}-${activeUserInputRequestId ?? "no-input"}`;
}

export function isMessagesScrollNearBottom(node: HTMLDivElement, thresholdPx: number) {
  return node.scrollHeight - node.scrollTop - node.clientHeight <= thresholdPx;
}

export function resolveActiveMessageAnchor(
  container: HTMLDivElement | null,
  messageNodeById: Map<string, HTMLDivElement>,
) {
  if (!container) {
    return null;
  }
  const viewportAnchorY =
    container.scrollTop + Math.min(96, container.clientHeight * 0.32);
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [messageId, node] of messageNodeById) {
    const distance = Math.abs(node.offsetTop - viewportAnchorY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = messageId;
    }
  }
  return bestId;
}

export function resolveVisibleMessageItems(options: {
  items: ConversationItem[];
  activeEngine: MessagesEngine;
  hideClaudeReasoning: boolean;
  latestTitleOnlyReasoningId: string | null;
  presentationProfile: PresentationProfile | null;
  reasoningMetaById: Map<string, ReturnType<typeof parseReasoning>>;
}) {
  const {
    items,
    activeEngine,
    hideClaudeReasoning,
    latestTitleOnlyReasoningId,
    presentationProfile,
    reasoningMetaById,
  } = options;
  const filtered = items.filter((item) => {
    if (
      (activeEngine === "codex" || activeEngine === "claude") &&
      item.kind === "explore" &&
      item.status === "exploring"
    ) {
      return false;
    }
    if (hideClaudeReasoning && item.kind === "reasoning") {
      return false;
    }
    if (item.kind === "tool" && shouldHideToolItemForRender(item)) {
      return false;
    }
    if (item.kind !== "reasoning") {
      return true;
    }
    const parsed = reasoningMetaById.get(item.id);
    const hasBody = parsed?.hasBody ?? false;
    if (hasBody) {
      return true;
    }
    if (!parsed?.workingLabel) {
      return false;
    }
    if (
      (activeEngine === "gemini" || activeEngine === "grok" || activeEngine === "kimi" || activeEngine === "opencode") &&
      isExplicitReasoningSegmentId(item.id)
    ) {
      return true;
    }
    if (activeEngine === "claude") {
      return true;
    }
    const keepTitleOnlyReasoning = presentationProfile
      ? presentationProfile.showReasoningLiveDot
      : activeEngine === "codex";
    return keepTitleOnlyReasoning || item.id === latestTitleOnlyReasoningId;
  });
  const appendReasoningRuns =
    activeEngine === "claude" || activeEngine === "gemini" || activeEngine === "grok" || activeEngine === "kimi" || activeEngine === "opencode";
  const deduped = dedupeAdjacentReasoningItems(
    filtered,
    reasoningMetaById,
    appendReasoningRuns,
    toConversationEngine(activeEngine),
  );
  // codex 也合并相邻思考块（与 session-activity 面板行为一致），中间有工具调用会自然断开。
  return collapseConsecutiveReasoningRuns(deduped, true, appendReasoningRuns);
}

/**
 * Collapse only the process run that immediately precedes each assistant prose
 * message. Trailing process without following text stays fully expanded.
 *
 * Performance model (hard unmount):
 * - Live open process (no following prose yet): fully mounted.
 * - After prose lands and phase collapses: process rows are removed from the
 *   timeline (summary chip only) so React trees are freed.
 * - User expands a phase: process rows remount (no long-lived instance cache).
 */
export function resolveCollapsedTimelineItems(options: {
  activeEngine: MessagesEngine;
  /** @deprecated ignored — phase collapse is always on */
  collapseLiveMiddleStepsEnabled?: boolean;
  /** Phase keys currently expanded by the user (usually assistant item ids). */
  expandedPhaseKeys?: ReadonlySet<string>;
  /** @deprecated ignored — expand is per-phase */
  expandMiddleSteps?: boolean;
  isThinking?: boolean;
  latestAssistantMessageId?: string | null;
  latestReasoningId?: string | null;
  timelineSourceItems: ConversationItem[];
}): CollapsedTimelineItemsResult {
  const {
    activeEngine,
    expandedPhaseKeys = new Set<string>(),
    timelineSourceItems,
  } = options;
  if (timelineSourceItems.length <= 2) {
    return emptyCollapsedTimelineResult(timelineSourceItems);
  }

  const phases: ProcessPhaseCollapse[] = [];
  const unmountedItemIds = new Set<string>();

  for (let index = 0; index < timelineSourceItems.length; index += 1) {
    const item = timelineSourceItems[index];
    if (!item || !isAssistantMessageWithVisibleText(item)) {
      continue;
    }

    // Walk back over the contiguous process run immediately above this text.
    let phaseStart = index;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const previous = timelineSourceItems[cursor];
      if (!previous || !isCollapsibleProcessItem(previous)) {
        break;
      }
      phaseStart = cursor;
    }
    if (phaseStart >= index) {
      continue;
    }

    // Claude live may reuse one id for the dual reasoning/assistant surface.
    // Never fold that shared-identity reasoning into the chip — it is the same UI unit.
    const phaseItems = timelineSourceItems
      .slice(phaseStart, index)
      .filter((phaseItem) => phaseItem.id !== item.id);
    if (phaseItems.length === 0) {
      continue;
    }
    const renderableCount = countRenderableCollapsedEntries(phaseItems, activeEngine);
    // Skip empty phases and single-step runs (no value in collapsing one step).
    if (renderableCount <= 1) {
      continue;
    }

    const phaseKey = item.id;
    const expanded = expandedPhaseKeys.has(phaseKey);
    const firstProcessItem = phaseItems[0];
    if (!firstProcessItem) {
      continue;
    }
    const hiddenItemIds = phaseItems.map((phaseItem) => phaseItem.id);
    // Hard unmount when collapsed: drop process rows so tool/reasoning trees free.
    if (!expanded) {
      for (const hiddenId of hiddenItemIds) {
        unmountedItemIds.add(hiddenId);
      }
    }
    phases.push({
      phaseKey,
      assistantItemId: item.id,
      insertBeforeItemId: firstProcessItem.id,
      count: renderableCount,
      breakdown: resolvePhaseBreakdown(phaseItems),
      durationMs: resolvePhaseDurationMs(phaseItems),
      expanded,
      hiddenItemIds,
    });
  }

  if (phases.length === 0) {
    return emptyCollapsedTimelineResult(timelineSourceItems);
  }

  if (unmountedItemIds.size === 0) {
    return {
      timelineItems: timelineSourceItems,
      phases,
    };
  }

  return {
    timelineItems: timelineSourceItems.filter((item) => !unmountedItemIds.has(item.id)),
    phases,
  };
}
