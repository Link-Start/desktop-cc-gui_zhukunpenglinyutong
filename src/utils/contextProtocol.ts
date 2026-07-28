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
const SHARED_RUNTIME_PROMPT = new RegExp(
  `^(MOSSX_CONTEXT_PACKAGE:${SHA256}:${SHA256})\\r?\\n` +
    "MOSSX_SHARED_CONTEXT_V1\\r?\\n" +
    "session:[^\\r\\n]+\\r?\\n" +
    "binding:[^\\r\\n]+\\r?\\n" +
    "[\\s\\S]*\\r?\\n\\1\\r?\\n" +
    "\\r?\\nCurrent user request:\\r?\\n[\\s\\S]+$",
);

export type ContextProtocolKind =
  | "context-package"
  | "context-accepted"
  | "native-context-prompt"
  | "shared-runtime-prompt";

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
  if (SHARED_RUNTIME_PROMPT.test(normalized)) {
    return "shared-runtime-prompt";
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
    const protocolKind =
      item.kind === "message"
        ? classifyContextProtocolText(item.text)
        : null;
    if (protocolKind === "shared-runtime-prompt") {
      // Shared V2 已有 canonical user turn；native Runtime replay 只是 transport
      // echo。只隐藏该重复 user item，不能把随后的 reasoning/assistant 当成
      // bootstrap ACK 一并吞掉。
      return false;
    }
    if (protocolKind !== null) {
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
      const kind = classifyContextProtocolText(item.text);
      return kind !== null && kind !== "shared-runtime-prompt";
    }
  }
  return false;
}
