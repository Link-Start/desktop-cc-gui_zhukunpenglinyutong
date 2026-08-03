import type {
  ConversationItem,
  EngineType,
  SendConversationCompletionEmailRequest,
} from "../../../types";

const MAX_SUMMARY_LINE_LENGTH = 220;
const MAX_SUMMARY_LINES = 5;
const MAX_FINAL_MESSAGE_LINES = 80;
const MAX_FINAL_MESSAGE_CHARS = 8000;
const MAX_USER_CONTEXT_CHARS = 800;
const MAX_SUBJECT_SESSION_CHARS = 28;
const MAX_SUBJECT_WORKSPACE_CHARS = 24;
const MAX_SUBJECT_TOTAL_CHARS = 120;
const REPLY_DELIMITER = "--- Reply above this line ---";

type ConversationCompletionEmailBuildOptions = {
  mailDrivenSessionEnabled?: boolean;
  minAssistantFinalCompletedAt?: number;
};

type MessageItem = Extract<ConversationItem, { kind: "message" }>;

export type ConversationCompletionEmailMetadata = {
  workspaceId: string;
  workspaceName?: string | null;
  workspacePath?: string | null;
  threadId: string;
  threadName?: string | null;
  turnId: string;
  engine?: EngineType | null;
};

export type ConversationCompletionEmailBuildResult =
  | {
      status: "ready";
      request: SendConversationCompletionEmailRequest;
      userMessage: string;
      assistantMessage: string;
      activityCount: number;
    }
  | {
      status: "skipped";
      reason: "missing_user_message" | "missing_assistant_message" | "missing_metadata";
    };

function isMessageItem(item: ConversationItem): item is MessageItem {
  return item.kind === "message";
}

function nonEmptyText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function compactLine(value: string | null | undefined): string {
  return nonEmptyText(value).replace(/\s+/g, " ");
}

function truncateLine(value: string, maxLength = MAX_SUMMARY_LINE_LENGTH): string {
  const compact = compactLine(stripMarkdownForEmail(value));
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 14)).trimEnd()}...[truncated]`;
}

function truncateUserContext(value: string): string {
  const compact = compactLine(stripMarkdownForEmail(value));
  if (compact.length <= MAX_USER_CONTEXT_CHARS) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, MAX_USER_CONTEXT_CHARS - 14)).trimEnd()}...[truncated]`;
}

function truncateTextByChars(value: string, maxChars: number): string {
  const chars = Array.from(value);
  if (chars.length <= maxChars) {
    return value;
  }
  return `${chars.slice(0, Math.max(0, maxChars - 14)).join("").trimEnd()}...[truncated]`;
}

function truncateSubjectPart(value: string, maxChars: number): string {
  const compact = compactLine(value).replace(/[\r\n]/g, " ");
  const chars = Array.from(compact);
  if (chars.length <= maxChars) {
    return compact;
  }
  return `${chars.slice(0, Math.max(0, maxChars - 3)).join("").trimEnd()}...`;
}

function formatEngineLabel(engine: EngineType | null | undefined): string | null {
  switch (engine) {
    case "claude":
      return "Claude";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini";
    case "grok":
      return "Grok";
    case "kimi":
      return "Kimi";
    case "opencode":
      return "OpenCode";
    default:
      return null;
  }
}

function buildCompletionSubject(metadata: ConversationCompletionEmailMetadata): string {
  const workspaceLabel = truncateSubjectPart(
    metadata.workspaceName?.trim() || metadata.workspaceId,
    MAX_SUBJECT_WORKSPACE_CHARS,
  );
  const sessionLabel = truncateSubjectPart(
    metadata.threadName?.trim() || metadata.threadId,
    MAX_SUBJECT_SESSION_CHARS,
  );
  const engineLabel = formatEngineLabel(metadata.engine);
  const normalizedWorkspace = workspaceLabel.toLocaleLowerCase();
  const normalizedSession = sessionLabel.toLocaleLowerCase();
  const subjectParts = [
    engineLabel,
    sessionLabel,
    normalizedSession === normalizedWorkspace ? null : workspaceLabel,
  ].filter((part): part is string => Boolean(part));

  return truncateSubjectPart(
    `Moss completed - ${subjectParts.join(" · ")}`,
    MAX_SUBJECT_TOTAL_CHARS,
  );
}

function stripMarkdownForEmail(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "")
    .trim();
}

function isFinalMessageBoundaryLine(value: string): boolean {
  const normalized = stripMarkdownForEmail(value);
  return normalized.includes("最终消息") || /\bfinal message\b/i.test(normalized);
}

function isReasoningBoundaryLine(value: string): boolean {
  const normalized = stripMarkdownForEmail(value);
  return normalized.includes("推理过程") || /\breasoning(?: process)?\b/i.test(normalized);
}

function trimBlankEdges(lines: string[]): string[] {
  let startIndex = 0;
  let endIndex = lines.length;
  while (startIndex < endIndex && !lines[startIndex]?.trim()) {
    startIndex += 1;
  }
  while (endIndex > startIndex && !lines[endIndex - 1]?.trim()) {
    endIndex -= 1;
  }
  return lines.slice(startIndex, endIndex);
}

function extractSummaryLines(assistantMessage: string): string[] {
  const bulletLines = assistantMessage
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S+/.test(line) || /^\d+\.\s+\S+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
    .map((line) => truncateLine(line))
    .filter(Boolean);
  if (bulletLines.length > 0) {
    return bulletLines.slice(0, MAX_SUMMARY_LINES);
  }
  const sentenceLines = splitOnSentenceBoundaries(assistantMessage)
    .map((line) => truncateLine(line))
    .filter(Boolean);
  return sentenceLines.slice(0, MAX_SUMMARY_LINES);
}

/**
 * Split on whitespace that follows sentence-ending punctuation, keeping the
 * punctuation on the preceding segment — equivalent to
 * `text.split(/(?<=[.!?。！？])\s+/)` without lookbehind.
 *
 * Lookbehind is unsupported on older Safari/WKWebView (`invalid group
 * specifier name`). Capture the terminator and re-attach it instead.
 */
function splitOnSentenceBoundaries(text: string): string[] {
  const parts = text.split(/([.!?。！？])\s+/);
  const lines: string[] = [];
  for (let i = 0; i < parts.length; ) {
    const body = parts[i] ?? "";
    const punct = parts[i + 1];
    if (typeof punct === "string" && /[.!?。！？]/.test(punct)) {
      lines.push(`${body}${punct}`);
      i += 2;
      continue;
    }
    if (body.length > 0) {
      lines.push(body);
    }
    i += 1;
  }
  return lines;
}

function extractFinalMessageLines(assistantMessage: string): string[] {
  const rawLines = assistantMessage.replace(/\r\n?/g, "\n").split("\n");
  const finalBoundaryIndex = rawLines.findLastIndex(isFinalMessageBoundaryLine);
  const startIndex = finalBoundaryIndex >= 0 ? finalBoundaryIndex + 1 : 0;
  const reasoningBoundaryOffset = rawLines.slice(startIndex).findIndex(isReasoningBoundaryLine);
  const endIndex =
    reasoningBoundaryOffset >= 0 ? startIndex + reasoningBoundaryOffset : rawLines.length;
  const finalLines = trimBlankEdges(rawLines.slice(startIndex, endIndex));
  if (finalLines.length === 0) {
    return [];
  }

  const limitedLines: string[] = [];
  let usedChars = 0;
  let truncated = false;
  for (const rawLine of finalLines) {
    if (limitedLines.length >= MAX_FINAL_MESSAGE_LINES) {
      truncated = true;
      break;
    }
    const formattedLine = rawLine.trim() ? rawLine.trimEnd() : "";
    const remainingChars = MAX_FINAL_MESSAGE_CHARS - usedChars;
    if (remainingChars <= 0) {
      truncated = true;
      break;
    }
    const safeLine = truncateTextByChars(formattedLine, remainingChars);
    const nextUsedChars = usedChars + Array.from(safeLine).length;
    if (nextUsedChars > MAX_FINAL_MESSAGE_CHARS) {
      truncated = true;
      break;
    }
    limitedLines.push(safeLine);
    usedChars = nextUsedChars;
    if (safeLine.endsWith("...[truncated]")) {
      truncated = true;
      break;
    }
  }

  if (truncated) {
    limitedLines.push("[内容过长，已截断；完整内容请回到 Moss 客户端查看。]");
  }
  return trimBlankEdges(limitedLines);
}

function formatSummarySection(assistantMessage: string): string[] {
  const finalMessageLines = extractFinalMessageLines(assistantMessage);
  if (finalMessageLines.length > 0) {
    return finalMessageLines;
  }

  const summaryLines = extractSummaryLines(assistantMessage);
  const lines = summaryLines.length > 0 ? summaryLines : ["本轮已完成，完整内容请回到 Moss 会话查看。"];
  return lines.map((line) => `- ${line}`);
}

function buildNextRecommendations(assistantMessage: string): string[] {
  const lower = assistantMessage.toLowerCase();
  if (lower.includes("test") || lower.includes("验证") || lower.includes("校验")) {
    return ["查看客户端会话中的验证结果，确认是否需要继续补测试或修复失败项。"];
  }
  return ["回到 Moss 会话查看完整结果，确认是否需要继续执行下一步。"];
}

function isAssistantCompletedAfter(
  item: MessageItem,
  minCompletedAt: number | undefined,
): boolean {
  if (typeof minCompletedAt !== "number") {
    return true;
  }
  return (
    typeof item.finalCompletedAt === "number" &&
    item.finalCompletedAt >= minCompletedAt
  );
}

function findFinalAssistantIndex(
  items: ConversationItem[],
  options: ConversationCompletionEmailBuildOptions,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item &&
      isMessageItem(item) &&
      item.role === "assistant" &&
      item.isFinal === true &&
      isAssistantCompletedAfter(item, options.minAssistantFinalCompletedAt) &&
      nonEmptyText(item.text)
    ) {
      return index;
    }
  }

  if (typeof options.minAssistantFinalCompletedAt === "number") {
    return -1;
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item &&
      isMessageItem(item) &&
      item.role === "assistant" &&
      nonEmptyText(item.text)
    ) {
      return index;
    }
  }
  return -1;
}

function findUserIndexBefore(items: ConversationItem[], beforeIndex: number): number {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item &&
      isMessageItem(item) &&
      item.role === "user" &&
      (nonEmptyText(item.text) || (item.images?.length ?? 0) > 0)
    ) {
      return index;
    }
  }
  return -1;
}

function collectAssistantVisibleTextForTurn(
  items: ConversationItem[],
  userIndex: number,
  assistantIndex: number,
): string {
  const textParts: string[] = [];
  for (let index = userIndex + 1; index <= assistantIndex; index += 1) {
    const item = items[index];
    if (!item || !isMessageItem(item) || item.role !== "assistant") {
      continue;
    }
    const text = nonEmptyText(item.text);
    if (!text) {
      continue;
    }
    const previous = textParts[textParts.length - 1];
    if (previous && compactLine(previous) === compactLine(text)) {
      continue;
    }
    textParts.push(text);
  }
  return textParts.join("\n\n").trim();
}

export function buildConversationCompletionEmail(
  items: ConversationItem[],
  metadata: ConversationCompletionEmailMetadata,
  options: ConversationCompletionEmailBuildOptions = {},
): ConversationCompletionEmailBuildResult {
  if (
    !metadata.workspaceId.trim() ||
    !metadata.threadId.trim() ||
    !metadata.turnId.trim()
  ) {
    return { status: "skipped", reason: "missing_metadata" };
  }

  const assistantIndex = findFinalAssistantIndex(items, options);
  if (assistantIndex < 0) {
    return { status: "skipped", reason: "missing_assistant_message" };
  }

  const userIndex = findUserIndexBefore(items, assistantIndex);
  if (userIndex < 0) {
    return { status: "skipped", reason: "missing_user_message" };
  }

  const userItem = items[userIndex] as MessageItem;
  const assistantItem = items[assistantIndex] as MessageItem;
  const userMessage = nonEmptyText(userItem.text) || "[Image-only message]";
  const assistantMessage =
    collectAssistantVisibleTextForTurn(items, userIndex, assistantIndex) ||
    nonEmptyText(assistantItem.text);
  if (!assistantMessage) {
    return { status: "skipped", reason: "missing_assistant_message" };
  }

  const subject = buildCompletionSubject(metadata);
  const fixSummaryLines = formatSummarySection(assistantMessage);
  const nextRecommendations = buildNextRecommendations(assistantMessage);
  const replySections = options.mailDrivenSessionEnabled
    ? [
        "",
        "如何回复",
        "直接点回复，在最上面写一句话即可：",
        "- 继续：执行下一步",
        "- 直接写要求：按你的新要求继续，例如“不要改 UI，先修后端”",
        "- 暂停 / 停止 / 状态",
        "",
        "请在下面这条线以上回复；线以下内容用于 Moss 识别会话，请保留原文。",
        REPLY_DELIMITER,
      ]
    : [
        "",
        "回复说明",
        "这封邮件只是完成通知，不能直接驱动 Moss。要用邮件继续此 session，请先在 Moss 的“邮件会话”里启用回复继续。",
      ];
  const sections = [
    "本轮已完成。",
    "",
    "本轮用户请求",
    truncateUserContext(userMessage),
    "",
    "本轮修复信息",
    ...fixSummaryLines,
    "",
    "下一步建议",
    ...nextRecommendations.map((recommendation, index) => `${index + 1}. ${recommendation}`),
    ...replySections,
    "",
    "完整 diff 或命令输出请回到 Moss 客户端会话查看。",
  ];

  return {
    status: "ready",
    request: {
      workspaceId: metadata.workspaceId,
      workspaceName: metadata.workspaceName ?? null,
      threadId: metadata.threadId,
      threadName: metadata.threadName ?? null,
      turnId: metadata.turnId,
      sessionId: `ms_${metadata.threadId}`,
      subject,
      textBody: sections.join("\n"),
      mailDrivenSessionEnabled: options.mailDrivenSessionEnabled === true,
      summary: fixSummaryLines.join("\n"),
      nextRecommendations,
    },
    userMessage,
    assistantMessage,
    activityCount: 0,
  };
}
