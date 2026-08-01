import type { ConversationItem } from "../../../../types";
import {
  appendReasoningRunText,
  compactComparableReasoningText,
} from "../../presentation/messagesReasoning";

type LiveReasoningItem = Extract<ConversationItem, { kind: "reasoning" }>;
const liveReasoningMergeCache = new WeakMap<
  ConversationItem,
  { live: LiveReasoningItem; result: ConversationItem }
>();

function resolveLiveReasoningRenderItem(
  item: LiveReasoningItem,
  liveReasoningItem: LiveReasoningItem,
) {
  const cached = liveReasoningMergeCache.get(item);
  if (cached && cached.live === liveReasoningItem) {
    return cached.result;
  }
  const compactTimeline = compactComparableReasoningText(
    item.content || item.summary || "",
  );
  const compactLive = compactComparableReasoningText(
    liveReasoningItem.content || liveReasoningItem.summary || "",
  );
  const result: ConversationItem =
    compactTimeline && !compactLive.includes(compactTimeline)
      ? {
          ...liveReasoningItem,
          summary: appendReasoningRunText(item.summary, liveReasoningItem.summary),
          content: appendReasoningRunText(item.content, liveReasoningItem.content),
        }
      : liveReasoningItem;
  liveReasoningMergeCache.set(item, { live: liveReasoningItem, result });
  return result;
}

export function resolveTimelineLiveRenderItem(
  item: ConversationItem,
  liveAssistantItem: Extract<ConversationItem, { kind: "message" }> | null,
  liveReasoningItem: LiveReasoningItem | null,
) {
  if (item.kind === "message" && liveAssistantItem?.id === item.id) {
    return liveAssistantItem;
  }
  if (item.kind === "reasoning" && liveReasoningItem?.id === item.id) {
    return resolveLiveReasoningRenderItem(item, liveReasoningItem);
  }
  return item;
}
