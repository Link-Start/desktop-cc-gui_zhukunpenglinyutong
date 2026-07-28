import type { ConversationItem } from "../types";

const SHA256 = "sha256:[0-9a-f]{64}";
const PACKAGE_MARKER = new RegExp(
  `^MOSSX_CONTEXT_PACKAGE:${SHA256}:${SHA256}$`,
);
const ACCEPTED_MARKER = new RegExp(
  `^MOSSX_CONTEXT_ACCEPTED:${SHA256}:${SHA256}$`,
);
const NATIVE_CONTEXT_PROMPT = new RegExp(
  `^MOSSX_CONTEXT_PACKAGE:${SHA256}:${SHA256}\\r?\\n` +
    "MOSSX_NATIVE_CONTEXT_V1\\r?\\n" +
    "source:[^\\r\\n]+\\r?\\n" +
    "binding:[^\\r\\n]+(?:\\r?\\n|$)",
);

export type ContextProtocolKind =
  | "context-package"
  | "context-accepted"
  | "native-context-prompt";

export function classifyContextProtocolText(
  text: string,
): ContextProtocolKind | null {
  const normalized = text.trim();
  if (PACKAGE_MARKER.test(normalized)) {
    return "context-package";
  }
  if (ACCEPTED_MARKER.test(normalized)) {
    return "context-accepted";
  }
  if (NATIVE_CONTEXT_PROMPT.test(normalized)) {
    return "native-context-prompt";
  }
  return null;
}

export function isContextProtocolConversationItem(
  item: ConversationItem | undefined,
): boolean {
  return (
    item?.kind === "message" &&
    classifyContextProtocolText(item.text) !== null
  );
}

/**
 * Context bootstrap 是 control exchange：从 protocol user entry 开始，
 * 到下一条普通 user message 之前的 assistant/reasoning/lifecycle 展示都不属于
 * 用户对话。只在 presentation boundary 过滤，vendor history 仍完整保留。
 */
export function filterContextProtocolConversationItems(
  items: ConversationItem[],
): ConversationItem[] {
  let insideControlExchange = false;
  return items.filter((item) => {
    if (isContextProtocolConversationItem(item)) {
      insideControlExchange = true;
      return false;
    }
    if (
      item.kind === "message" &&
      item.role === "user"
    ) {
      insideControlExchange = false;
      return true;
    }
    return !insideControlExchange;
  });
}

export function hasContextProtocolControlTail(
  items: ConversationItem[],
): boolean {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      return isContextProtocolConversationItem(item);
    }
  }
  return false;
}
