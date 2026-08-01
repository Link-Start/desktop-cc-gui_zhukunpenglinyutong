import { convertFileSrc } from "@tauri-apps/api/core";
import type { ConversationItem } from "../../../types";
import type {
  ConversationEngine,
  ConversationState,
} from "../../threads/contracts/conversationCurtainContracts";
import type { PresentationProfile } from "../../../conversation-presentation/presentationProfile";
import { groupToolItems } from "./groupToolItems";
import {
  isAssistantMessageConversationItem,
  isUserMessageConversationItem,
} from "./messageItemPredicates";
import { compactComparableReasoningText, parseReasoning } from "../presentation/messagesReasoning";
import { buildCommandSummary, extractToolName, isBashTool } from "../components/toolBlocks/toolConstants";

export const SCROLL_THRESHOLD_PX = 120;
export const OPENCODE_NON_STREAMING_HINT_DELAY_MS = 12_000;
const MESSAGES_PERF_DEBUG_FLAG_KEY = "ccgui.debug.messages.perf";
const CLAUDE_HIDE_REASONING_MODULE_FLAG_KEY = "ccgui.claude.hideReasoningModule";
const CLAUDE_RENDER_DEBUG_FLAG_KEY = "ccgui.debug.claude.render";
export const MESSAGES_SLOW_RENDER_WARN_MS = 18;
export const MESSAGES_SLOW_ANCHOR_WARN_MS = 8;
export const VISIBLE_MESSAGE_WINDOW = 10000;
// 流式期（isThinking）的 live 尾窗口。buildLiveTailWorkingSet 仅在 isThinking 时按此裁剪，
// 保留最近约 STREAMING_VISIBLE_WINDOW*2 个条目（含最新用户提问，供 bottom-follow 锚定），
// 其余折叠进既有的「显示更早」指示器（omittedBeforeWorkingSetCount）。这把流式期每帧的
// 渲染/协调/DOM 规模从 O(全历史) 压到 O(尾窗)，直击「越聊越卡」；idle/展开态仍用
// VISIBLE_MESSAGE_WINDOW=10000 全量渲染，行为不变。走的是现成、已测试的窗口机器，未触碰
// TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED（故意 false）。
// ⚠️ 改动了流式期的可见集：必须真机验证长对话在流式「开始/结束」瞬间 bottom-follow 自动跟随
// 不跳动、「显示更早」可展开；若跟随跳动，调大此值或改走「已完成行降级为占位」方案。
export const STREAMING_VISIBLE_WINDOW = 60;

export type MessagesEngine = "claude" | "codex" | "gemini" | "grok" | "kimi" | "opencode";

export function isSelectionInsideNode(selection: Selection | null, node: HTMLElement | null) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !node) {
    return false;
  }
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    if (node.contains(range.commonAncestorContainer)) {
      return true;
    }
  }
  return false;
}

export function isMessagesPerfDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(MESSAGES_PERF_DEBUG_FLAG_KEY) === "1";
}

export function shouldHideClaudeReasoningModule(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const value = window.localStorage.getItem(CLAUDE_HIDE_REASONING_MODULE_FLAG_KEY);
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return !(normalized === "0" || normalized === "false" || normalized === "off");
  } catch {
    return false;
  }
}

export function isClaudeRenderDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const value = window.localStorage.getItem(CLAUDE_RENDER_DEBUG_FLAG_KEY);
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on";
  } catch {
    return false;
  }
}

export function logClaudeRender(label: string, payload: Record<string, unknown>) {
  if (!isClaudeRenderDebugEnabled()) {
    return;
  }
  console.info(`[messages][claude-render] ${label}`, payload);
}

export function logMessagesPerf(label: string, payload: Record<string, unknown>): void {
  if (!isMessagesPerfDebugEnabled()) {
    return;
  }
  console.info(`[messages][perf] ${label}`, payload);
}

export function normalizeAgentTaskStatus(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return { label: "agent", tone: "neutral" as const };
  }
  if (/(fail|error|cancel(?:led)?|abort|timeout|timed[_ -]?out)/.test(normalized)) {
    return { label: value?.trim() ?? "error", tone: "error" as const };
  }
  if (/(complete|completed|success|done|finish(?:ed)?)/.test(normalized)) {
    return { label: value?.trim() ?? "completed", tone: "completed" as const };
  }
  if (/(running|processing|started|in[_ -]?progress|queued|pending)/.test(normalized)) {
    return { label: value?.trim() ?? "running", tone: "running" as const };
  }
  return { label: value?.trim() ?? normalized, tone: "neutral" as const };
}

export function basenameFromPath(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return null;
  }
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

export function resolveAgentTaskDisplaySummary(summary: string | null | undefined) {
  const normalized = (summary ?? "").trim();
  if (!normalized) {
    return {
      title: "Agent result",
      subtitle: null as string | null,
    };
  }
  const match =
    /Agent\s+["“]?([^"”]+)["”]?/i.exec(normalized)
    ?? /智能体\s*["“]?([^"”]+)["”]?/i.exec(normalized);
  const title = match?.[1]?.trim() || normalized;
  return {
    title,
    subtitle: title === normalized ? null : normalized,
  };
}

export function toConversationEngine(engine: MessagesEngine): ConversationEngine {
  if (engine === "claude" || engine === "gemini" || engine === "grok" || engine === "kimi" || engine === "opencode") {
    return engine;
  }
  return "codex";
}

export function resolveRenderableItems({
  legacyItems,
  legacyThreadId: _legacyThreadId,
  legacyWorkspaceId: _legacyWorkspaceId,
  conversationState,
}: {
  legacyItems: ConversationItem[];
  legacyThreadId: string | null;
  legacyWorkspaceId: string | null;
  conversationState: ConversationState | null;
}) {
  if (!conversationState) {
    return legacyItems;
  }
  return conversationState.items;
}

export function normalizeMessageImageSrc(path: string) {
  if (!path) {
    return "";
  }
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("file://")) {
    return path;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return "";
  }
}

export function formatDurationMs(durationMs: number) {
  const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const durationHours = Math.floor(durationSeconds / 3600);
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationRemainder = durationSeconds % 60;
  if (durationHours > 0) {
    const remainderMinutes = durationMinutes % 60;
    return `${durationHours}:${String(remainderMinutes).padStart(2, "0")}:${String(durationRemainder).padStart(2, "0")}`;
  }
  return `${durationMinutes}:${String(durationRemainder).padStart(2, "0")}`;
}

/** Compact token count for message footers (1234 → "1.2K"), matching jetbrains MessageItem. */
export function formatTokenCount(count: number) {
  if (!Number.isFinite(count) || count < 0) {
    return "0";
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(Math.floor(count));
}

export function formatCompletedTimeMs(timestampMs: number) {
  const date = new Date(timestampMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}:${seconds}`;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Whole seconds for compact duration labels like "耗时13s". */
export function formatDurationSecondsLabel(durationMs: number) {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${seconds}s`;
}

/**
 * Build final-boundary meta next to message actions, e.g.
 * "07-31 20:42:26 耗时13s · 输入 41.1K token / 输出 105 token"
 */
export function buildAssistantFinalBoundaryMetaText(options: {
  finalDurationMs?: number;
  finalInputTokens?: number;
  finalOutputTokens?: number;
  finalCompletedAt?: number;
  t: TranslateFn;
}): string {
  const headParts: string[] = [];
  if (
    typeof options.finalCompletedAt === "number" &&
    options.finalCompletedAt > 0
  ) {
    headParts.push(formatCompletedTimeMs(options.finalCompletedAt));
  }
  if (
    typeof options.finalDurationMs === "number" &&
    Number.isFinite(options.finalDurationMs) &&
    options.finalDurationMs >= 0
  ) {
    headParts.push(
      options.t("messages.durationSeconds", {
        seconds: Math.max(0, Math.floor(options.finalDurationMs / 1000)),
      }),
    );
  }
  const inputTokens =
    typeof options.finalInputTokens === "number" &&
    Number.isFinite(options.finalInputTokens) &&
    options.finalInputTokens > 0
      ? options.finalInputTokens
      : 0;
  const outputTokens =
    typeof options.finalOutputTokens === "number" &&
    Number.isFinite(options.finalOutputTokens) &&
    options.finalOutputTokens > 0
      ? options.finalOutputTokens
      : 0;
  const tokenText =
    inputTokens > 0 || outputTokens > 0
      ? options.t("messages.tokenUsageTooltip", {
          input: formatTokenCount(inputTokens),
          output: formatTokenCount(outputTokens),
        })
      : "";
  const head = headParts.join(" ");
  if (head && tokenText) {
    return `${head} · ${tokenText}`;
  }
  return head || tokenText;
}

/** @deprecated Alias kept for call sites that still use the object helper name. */
export function buildAssistantFinalBoundaryMeta(options: {
  finalDurationMs?: number;
  finalInputTokens?: number;
  finalOutputTokens?: number;
  finalCompletedAt?: number;
  t: TranslateFn;
}) {
  return {
    text: buildAssistantFinalBoundaryMetaText(options),
    tokenTooltip: null as string | null,
  };
}

export function scrollKeyForItems(items: ConversationItem[]) {
  if (!items.length) {
    return "empty";
  }
  const last = items[items.length - 1];
  if (!last) {
    return "empty";
  }
  switch (last.kind) {
    case "message":
      return `${last.id}-${last.text.length}`;
    case "reasoning":
      return `${last.id}-${last.summary.length}-${last.content.length}`;
    case "explore":
      return `${last.id}-${last.status}-${last.entries.length}`;
    case "generatedImage":
      return `${last.id}-${last.status}-${last.images.length}`;
    case "tool":
      return `${last.id}-${last.status ?? ""}-${last.output?.length ?? 0}`;
    case "diff":
      return `${last.id}-${last.status ?? ""}-${last.diff.length}`;
    case "review":
      return `${last.id}-${last.state}-${last.text.length}`;
    default: {
      const _exhaustive: never = last;
      return _exhaustive;
    }
  }
}

export function resolveCodexCommandActivityLabel(item: Extract<ConversationItem, { kind: "tool" }>) {
  return buildCommandSummary(item, { includeDetail: false });
}

/**
 * Hide bash/command tool cards on the conversation canvas (Claude-polished surface).
 * Applies to Claude/Codex and, after unify-conversation-canvas, also Grok/Kimi/OpenCode
 * so multi-CLI process chrome matches: narrative on canvas, shell noise in Status Panel.
 * ExitPlanMode remains visible.
 */
export function shouldHideCodexCanvasCommandCard(
  item: Extract<ConversationItem, { kind: "tool" }>,
  activeEngine: MessagesEngine,
) {
  if (
    activeEngine !== "codex" &&
    activeEngine !== "claude" &&
    activeEngine !== "grok" &&
    activeEngine !== "kimi" &&
    activeEngine !== "opencode"
  ) {
    return false;
  }
  const normalizedToolName = extractToolName(item.title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (
    normalizedToolName === "exitplanmode" ||
    normalizedToolName.endsWith("exitplanmode")
  ) {
    return false;
  }
  if (item.toolType === "commandExecution") {
    return true;
  }
  return isBashTool(extractToolName(item.title).toLowerCase());
}

export function isClaudeHistoryTranscriptHeavy(items: ConversationItem[]) {
  let assistantTextCount = 0;
  let reasoningCount = 0;
  let toolCount = 0;

  for (const item of items) {
    if (item.kind === "message" && item.role === "assistant" && item.text.trim()) {
      assistantTextCount += 1;
      continue;
    }
    if (item.kind === "reasoning") {
      reasoningCount += 1;
      continue;
    }
    if (item.kind === "tool") {
      toolCount += 1;
    }
  }

  return toolCount >= 1 && reasoningCount + toolCount >= 3 && assistantTextCount <= 1;
}

export function countRenderableCollapsedEntries(
  items: ConversationItem[],
  activeEngine: MessagesEngine,
) {
  if (items.length === 0) {
    return 0;
  }
  return groupToolItems(items).reduce((count, entry) => {
    if (entry.kind === "bashGroup") {
      // Hidden on polished multi-CLI canvas (Claude/Codex/Grok/Kimi/OpenCode).
      if (
        activeEngine === "codex" ||
        activeEngine === "claude" ||
        activeEngine === "grok" ||
        activeEngine === "kimi" ||
        activeEngine === "opencode"
      ) {
        return count;
      }
      return count + 1;
    }
    if (
      entry.kind === "item" &&
      entry.item.kind === "tool" &&
      shouldHideCodexCanvasCommandCard(entry.item, activeEngine)
    ) {
      return count;
    }
    return count + 1;
  }, 0);
}

export function resolveWorkingActivityLabel(
  item: ConversationItem,
  activeEngine: MessagesEngine = "claude",
  presentationProfile: PresentationProfile | null = null,
) {
  if (item.kind === "reasoning") {
    const parsed = parseReasoning(item);
    return parsed.workingLabel;
  }
  if (item.kind === "explore") {
    const lastEntry = item.entries[item.entries.length - 1];
    if (!lastEntry) {
      return item.status === "exploring" ? "Exploring..." : "Explored";
    }
    return lastEntry.detail ? `${lastEntry.label} (${lastEntry.detail})` : lastEntry.label;
  }
  if (item.kind === "generatedImage") {
    if (item.promptText?.trim()) {
      return item.promptText.trim();
    }
    return item.status === "processing" ? "Generating image..." : "Image ready";
  }
  if (item.kind === "tool") {
    const title = item.title?.trim();
    const detail = item.detail?.trim();
    const preferCommandSummary = presentationProfile
      ? presentationProfile.preferCommandSummary
      : activeEngine === "codex";
    if (preferCommandSummary) {
      const codexCommand = resolveCodexCommandActivityLabel(item);
      if (codexCommand) {
        return codexCommand;
      }
    }
    if (!title) {
      return null;
    }
    if (detail && item.toolType === "commandExecution") {
      return `${title} @ ${detail}`;
    }
    return title;
  }
  if (item.kind === "diff") {
    return item.title?.trim() || null;
  }
  if (item.kind === "review") {
    return item.state === "started" ? "Review started" : "Review completed";
  }
  return null;
}

export function findLastUserMessageIndex(items: ConversationItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (isUserMessageConversationItem(item)) {
      return index;
    }
  }
  return -1;
}

export function findLastAssistantMessageIndex(items: ConversationItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (isAssistantMessageConversationItem(item)) {
      return index;
    }
  }
  return -1;
}

export function findLatestAssistantMessageIdAfterIndex(
  items: ConversationItem[],
  startIndex: number,
) {
  for (let index = items.length - 1; index > startIndex; index -= 1) {
    const item = items[index];
    if (isAssistantMessageConversationItem(item)) {
      return item.id;
    }
  }
  return null;
}

export function shouldDisplayWorkingActivityLabel(
  reasoningLabel: string | null,
  activityLabel: string | null,
) {
  if (!activityLabel) {
    return false;
  }
  if (!reasoningLabel) {
    return true;
  }
  const compactReasoning = compactComparableReasoningText(reasoningLabel);
  const compactActivity = compactComparableReasoningText(activityLabel);
  if (!compactReasoning || !compactActivity) {
    return true;
  }
  if (compactReasoning === compactActivity) {
    return false;
  }
  if (compactReasoning.length >= 12 && compactActivity.includes(compactReasoning)) {
    return false;
  }
  if (compactActivity.length >= 12 && compactReasoning.includes(compactActivity)) {
    return false;
  }
  return true;
}
