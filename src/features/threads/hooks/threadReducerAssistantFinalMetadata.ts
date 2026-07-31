import type { ConversationItem, ThreadTokenUsage } from "../../../types";

type MessageItem = Extract<ConversationItem, { kind: "message" }>;
type AssistantMessageItem = MessageItem & { role: "assistant" };

export function clearAssistantFinalMetadata(
  item: AssistantMessageItem,
): AssistantMessageItem {
  const {
    finalCompletedAt: _finalCompletedAt,
    finalDurationMs: _finalDurationMs,
    finalInputTokens: _finalInputTokens,
    finalOutputTokens: _finalOutputTokens,
    ...rest
  } = item;
  return rest as AssistantMessageItem;
}

export function shouldPreserveAssistantFinalMetadata(
  item: AssistantMessageItem,
  isThreadProcessing: boolean,
) {
  return item.isFinal === true && !isThreadProcessing;
}

/**
 * Resolve whole-turn input/output for the message footer.
 * Input is the full input side (non-cache + cached) so cache-heavy turns
 * still surface a meaningful total, matching jetbrains MessageItem.
 */
export function resolveTurnTokenCountsFromUsage(
  tokenUsage: ThreadTokenUsage | null | undefined,
): { inputTokens: number; outputTokens: number } | null {
  if (!tokenUsage) {
    return null;
  }
  const source = tokenUsage.last ?? tokenUsage.total;
  if (!source) {
    return null;
  }
  const inputBase =
    typeof source.inputTokens === "number" && Number.isFinite(source.inputTokens)
      ? Math.max(0, source.inputTokens)
      : 0;
  const cached =
    typeof source.cachedInputTokens === "number" &&
    Number.isFinite(source.cachedInputTokens)
      ? Math.max(0, source.cachedInputTokens)
      : 0;
  const output =
    typeof source.outputTokens === "number" && Number.isFinite(source.outputTokens)
      ? Math.max(0, source.outputTokens)
      : 0;
  const inputTokens = inputBase + cached;
  if (inputTokens <= 0 && output <= 0) {
    return null;
  }
  return { inputTokens, outputTokens: output };
}

export function withAssistantTurnTokenCounts(
  item: AssistantMessageItem,
  tokenUsage: ThreadTokenUsage | null | undefined,
): AssistantMessageItem {
  const counts = resolveTurnTokenCountsFromUsage(tokenUsage);
  if (!counts) {
    return item;
  }
  if (
    item.finalInputTokens === counts.inputTokens &&
    item.finalOutputTokens === counts.outputTokens
  ) {
    return item;
  }
  return {
    ...item,
    finalInputTokens: counts.inputTokens,
    finalOutputTokens: counts.outputTokens,
  };
}

/** Stamp last-turn token usage onto the latest final assistant message. */
export function stampLatestFinalAssistantTurnTokens(
  items: ConversationItem[],
  tokenUsage: ThreadTokenUsage | null | undefined,
): ConversationItem[] {
  const counts = resolveTurnTokenCountsFromUsage(tokenUsage);
  if (!counts) {
    return items;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const candidate = items[index];
    if (
      !candidate ||
      candidate.kind !== "message" ||
      candidate.role !== "assistant" ||
      candidate.isFinal !== true
    ) {
      continue;
    }
    if (
      candidate.finalInputTokens === counts.inputTokens &&
      candidate.finalOutputTokens === counts.outputTokens
    ) {
      return items;
    }
    const next = [...items];
    next[index] = {
      ...candidate,
      finalInputTokens: counts.inputTokens,
      finalOutputTokens: counts.outputTokens,
    };
    return next;
  }
  return items;
}
