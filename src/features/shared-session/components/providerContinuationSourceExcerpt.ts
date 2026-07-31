import type { ConversationItem } from "../../../types";

export type ProviderContinuationSourceExcerpt = {
  userText: string | null;
  assistantText: string | null;
};

function readableMessageText(
  item: ConversationItem,
  role: "user" | "assistant",
): string | null {
  if (item.kind !== "message" || item.role !== role) {
    return null;
  }
  return item.text.trim() || null;
}

export function buildProviderContinuationSourceExcerpt(
  items: readonly ConversationItem[],
): ProviderContinuationSourceExcerpt | null {
  let lastUserIndex = -1;

  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (readableMessageText(items[index], "user")) {
      lastUserIndex = index;
      break;
    }
  }

  if (lastUserIndex >= 0) {
    let assistantText: string | null = null;
    for (let index = items.length - 1; index > lastUserIndex; index -= 1) {
      assistantText = readableMessageText(items[index], "assistant");
      if (assistantText) {
        break;
      }
    }
    return {
      userText: readableMessageText(items[lastUserIndex], "user"),
      assistantText,
    };
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const assistantText = readableMessageText(items[index], "assistant");
    if (assistantText) {
      return { userText: null, assistantText };
    }
  }

  return null;
}
