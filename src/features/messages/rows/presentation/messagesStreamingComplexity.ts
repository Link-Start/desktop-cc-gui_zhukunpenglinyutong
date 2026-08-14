import type { ConversationItem } from "../../../../types";
import type { StreamMitigationProfile } from "../../../threads/utils/streamLatencyDiagnostics";
import type { PresentationProfile } from "../../../../conversation-presentation/presentationProfile";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";

export type { StreamMitigationProfile };

export const LIVE_ASSISTANT_MARKDOWN_THROTTLE_MS = 48;
const CODEX_TINY_STREAMING_THROTTLE_MS = 72;

const CODEX_MEDIUM_STREAMING_THROTTLE_MS = 80;
const CODEX_LARGE_STREAMING_THROTTLE_MS = 120;
const CODEX_STRUCTURED_STREAMING_THROTTLE_MS = 160;
const CODEX_HUGE_STREAMING_THROTTLE_MS = 220;
const CODEX_MEDIUM_STREAMING_MIN_LENGTH = 260;
const CODEX_MEDIUM_STREAMING_MIN_LINES = 6;
const CODEX_LARGE_STREAMING_MIN_LENGTH = 700;
const CODEX_LARGE_STREAMING_MIN_LINES = 12;
const CODEX_STRUCTURED_STREAMING_MIN_HEADINGS = 3;
const CODEX_STRUCTURED_STREAMING_MIN_LIST_ITEMS = 6;
const CODEX_STRUCTURED_STREAMING_MIN_CODE_LINES = 8;
const CODEX_HUGE_STREAMING_MIN_LENGTH = 1_600;
const CODEX_HUGE_STREAMING_MIN_LINES = 36;

export type StreamingMarkdownComplexity = {
  trimmedText: string;
  lineCount: number;
  headingCount: number;
  listItemCount: number;
  fencedCodeBlockCount: number;
  fencedCodeLineCount: number;
  structuredBlockCount: number;
  isMedium: boolean;
  isLarge: boolean;
  isHuge: boolean;
  isStructuredHeavy: boolean;
  /**
   * 全文扫描结束时是否仍处于 fenced code block 内。
   * delta 路径靠它继承状态，避免每次 flush 重放整个前缀（O(n²) 累积）。
   */
  insideCodeFence: boolean;
};

export const EMPTY_STREAMING_MARKDOWN_COMPLEXITY: StreamingMarkdownComplexity = {
  trimmedText: "",
  lineCount: 0,
  headingCount: 0,
  listItemCount: 0,
  fencedCodeBlockCount: 0,
  fencedCodeLineCount: 0,
  structuredBlockCount: 0,
  isMedium: false,
  isLarge: false,
  isHuge: false,
  isStructuredHeavy: false,
  insideCodeFence: false,
};

export function analyzeStreamingMarkdownComplexity(
  displayText: string,
): StreamingMarkdownComplexity {
  const trimmedText = displayText.trim();
  if (!trimmedText) {
    return EMPTY_STREAMING_MARKDOWN_COMPLEXITY;
  }

  const lines = trimmedText.split(/\r?\n/);
  const lineCount = lines.length;
  let headingCount = 0;
  let listItemCount = 0;
  let fencedCodeBlockCount = 0;
  let fencedCodeLineCount = 0;
  let insideCodeFence = false;

  for (const line of lines) {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      continue;
    }
    if (normalizedLine.startsWith("```")) {
      fencedCodeBlockCount += insideCodeFence ? 0 : 1;
      insideCodeFence = !insideCodeFence;
      continue;
    }
    if (insideCodeFence) {
      fencedCodeLineCount += 1;
      continue;
    }
    if (/^#{1,6}\s+/.test(normalizedLine)) {
      headingCount += 1;
      continue;
    }
    if (/^(?:[-*+]|\d+[.)])\s+/.test(normalizedLine)) {
      listItemCount += 1;
    }
  }

  return finalizeStreamingMarkdownComplexity({
    trimmedText,
    lineCount,
    headingCount,
    listItemCount,
    fencedCodeBlockCount,
    fencedCodeLineCount,
    insideCodeFence,
  });
}

function finalizeStreamingMarkdownComplexity(counts: {
  trimmedText: string;
  lineCount: number;
  headingCount: number;
  listItemCount: number;
  fencedCodeBlockCount: number;
  fencedCodeLineCount: number;
  insideCodeFence: boolean;
}): StreamingMarkdownComplexity {
  const {
    trimmedText,
    lineCount,
    headingCount,
    listItemCount,
    fencedCodeBlockCount,
    fencedCodeLineCount,
    insideCodeFence,
  } = counts;
  const isMedium =
    trimmedText.length >= CODEX_MEDIUM_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_MEDIUM_STREAMING_MIN_LINES;
  const isLarge =
    trimmedText.length >= CODEX_LARGE_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_LARGE_STREAMING_MIN_LINES;
  const isHuge =
    trimmedText.length >= CODEX_HUGE_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_HUGE_STREAMING_MIN_LINES;
  const structuredBlockCount =
    headingCount + listItemCount + fencedCodeBlockCount + fencedCodeLineCount;
  const isStructuredHeavy =
    headingCount >= CODEX_STRUCTURED_STREAMING_MIN_HEADINGS ||
    listItemCount >= CODEX_STRUCTURED_STREAMING_MIN_LIST_ITEMS ||
    fencedCodeLineCount >= CODEX_STRUCTURED_STREAMING_MIN_CODE_LINES ||
    (fencedCodeBlockCount > 0 && structuredBlockCount >= CODEX_MEDIUM_STREAMING_MIN_LINES);

  return {
    trimmedText,
    lineCount,
    headingCount,
    listItemCount,
    fencedCodeBlockCount,
    fencedCodeLineCount,
    structuredBlockCount,
    isMedium,
    isLarge,
    isHuge,
    isStructuredHeavy,
    insideCodeFence,
  };
}

/**
 * 判定某引擎的流式 assistant 消息是否启用 staged 流式 markdown 路径。
 *
 * 历史上仅 codex 走该路径（useCodexStagedMarkdownThrottle），后来扩到 claude；
 * Gemini / Grok / Kimi / opencode 等引擎被排除在外、每帧全量 re-parse，长回答
 * 越写越卡。自 IncrementalMarkdown 增量排版落地起，staged 路径（增量渲染 +
 * staged 节流档位）对全部引擎统一生效——单帧排版成本已与正文长度脱钩，
 * 不再保留按引擎区分的旧白名单。
 */
export function shouldUseStagedStreamingMarkdown(
  activeEngine: MessagesEngine,
  presentationProfile: PresentationProfile | null | undefined,
): boolean {
  void activeEngine;
  void presentationProfile;
  return true;
}

export function resolveAssistantMessageStreamingThrottleMs(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  mitigationProfile: StreamMitigationProfile | null | undefined,
  presentationProfile: PresentationProfile | null | undefined,
  complexity: StreamingMarkdownComplexity,
) {
  if (!isStreaming) {
    return 80;
  }
  if (mitigationProfile?.messageStreamingThrottleMs) {
    return mitigationProfile.messageStreamingThrottleMs;
  }
  const baselineThrottleMs =
    presentationProfile?.assistantMarkdownStreamingThrottleMs ??
    LIVE_ASSISTANT_MARKDOWN_THROTTLE_MS;
  const useStagedMarkdownThrottle = shouldUseStagedStreamingMarkdown(
    activeEngine,
    presentationProfile,
  );
  if (item.role !== "assistant" || !useStagedMarkdownThrottle) {
    return baselineThrottleMs;
  }
  if (!complexity.trimmedText) {
    return baselineThrottleMs;
  }
  if (complexity.isHuge) {
    return CODEX_HUGE_STREAMING_THROTTLE_MS;
  }
  if (complexity.isStructuredHeavy && complexity.isLarge) {
    return CODEX_STRUCTURED_STREAMING_THROTTLE_MS;
  }
  if (complexity.isLarge) {
    return CODEX_LARGE_STREAMING_THROTTLE_MS;
  }
  if (complexity.isStructuredHeavy || complexity.isMedium) {
    return CODEX_MEDIUM_STREAMING_THROTTLE_MS;
  }
  return CODEX_TINY_STREAMING_THROTTLE_MS;
}

export function resolveReasoningStreamingThrottleMs(
  isLive: boolean,
  mitigationProfile: StreamMitigationProfile | null | undefined,
  presentationProfile: PresentationProfile | null | undefined,
) {
  if (!isLive) {
    return 80;
  }
  return (
    mitigationProfile?.reasoningStreamingThrottleMs ??
    presentationProfile?.reasoningStreamingThrottleMs ??
    180
  );
}

/**
 * Streaming-only incremental analysis for chat-stream-render-isolation-2026-06
 * task 3.1. `prev` MUST be the StreamingMarkdownComplexity previously computed
 * for `prevText`. `deltaText` MUST be the new text appended after `prevText`
 * (typical streaming path) — the helper assumes a suffix-append relationship
 * and walks the delta lines once, threading the inherited fenced-code state
 * from the previous pass.
 *
 * The helper produces a complexity object consistent with what
 * `analyzeStreamingMarkdownComplexity(nextText)` would return, but avoids
 * re-scanning the entire prefix. Empty / whitespace deltas are treated as
 * "no change" and return `prev` unchanged.
 */
export function analyzeStreamingMarkdownComplexityDelta(
  prev: StreamingMarkdownComplexity,
  prevText: string,
  deltaText: string,
): StreamingMarkdownComplexity {
  if (typeof deltaText !== "string" || deltaText.length === 0) {
    return prev;
  }
  const trimmedDelta = deltaText.trim();
  if (!trimmedDelta) {
    return prev;
  }
  const nextText = prevText + deltaText;
  const trimmedText = nextText.trim();
  if (!trimmedText) {
    return EMPTY_STREAMING_MARKDOWN_COMPLEXITY;
  }
  const counts = {
    headingCount: prev.headingCount,
    listItemCount: prev.listItemCount,
    fencedCodeBlockCount: prev.fencedCodeBlockCount,
    fencedCodeLineCount: prev.fencedCodeLineCount,
  };
  // fenced-code 状态直接从 prev 继承，不再重放整个前缀（旧实现每次 flush 扫
  // O(全文) 行，流式累积成 O(n²)）。
  let insideCodeFence = prev.insideCodeFence;
  let lineCount = prev.lineCount;
  let deltaLines: string[];

  const joinsExistingLine =
    prevText.length > 0 &&
    !/[\r\n]$/.test(prevText) &&
    !/^[\r\n]/.test(deltaText);
  if (joinsExistingLine) {
    // token 常 append 在同一行末尾：撤销旧末行的计数贡献，把「旧末行 + delta
    // 首段」当作一条新行重新分类，剩余 delta 行照常增量处理。旧实现在此分支
    // 直接全文重扫，恰好是流式最频繁的路径。
    const lastBreakIndex = Math.max(
      prevText.lastIndexOf("\n"),
      prevText.lastIndexOf("\r"),
    );
    const prevLastLine = prevText.slice(lastBreakIndex + 1);
    const prevLastTrimmed = prevLastLine.trim();
    let stateBeforeLastLine = insideCodeFence;
    if (prevLastTrimmed.startsWith("```")) {
      stateBeforeLastLine = !stateBeforeLastLine;
    }
    applyLineContribution(counts, prevLastTrimmed, stateBeforeLastLine, -1);
    insideCodeFence = stateBeforeLastLine;
    const deltaParts = deltaText.split(/\r?\n/);
    deltaParts[0] = prevLastLine + (deltaParts[0] ?? "");
    deltaLines = deltaParts;
    lineCount += deltaParts.length - 1;
  } else {
    deltaLines = trimmedDelta.split(/\r?\n/);
    for (const line of deltaLines) {
      if (line.length > 0) {
        lineCount += 1;
      }
    }
  }

  for (const line of deltaLines) {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      continue;
    }
    if (normalizedLine.startsWith("```")) {
      counts.fencedCodeBlockCount += insideCodeFence ? 0 : 1;
      insideCodeFence = !insideCodeFence;
      continue;
    }
    applyLineContribution(counts, normalizedLine, insideCodeFence, 1);
  }
  if (lineCount < 1 && trimmedText) {
    lineCount = 1;
  }
  return finalizeStreamingMarkdownComplexity({
    trimmedText,
    lineCount,
    ...counts,
    insideCodeFence,
  });
}

/**
 * 统计单行对 heading/list/code-line 计数的贡献（sign=+1 增加、-1 撤销）。
 * fence 开合行的计数与状态切换由调用方处理。
 */
function applyLineContribution(
  counts: {
    headingCount: number;
    listItemCount: number;
    fencedCodeBlockCount: number;
    fencedCodeLineCount: number;
  },
  normalizedLine: string,
  insideCodeFence: boolean,
  sign: 1 | -1,
) {
  if (!normalizedLine) {
    return;
  }
  if (normalizedLine.startsWith("```")) {
    counts.fencedCodeBlockCount += insideCodeFence ? 0 : sign;
    return;
  }
  if (insideCodeFence) {
    counts.fencedCodeLineCount += sign;
    return;
  }
  if (/^#{1,6}\s+/.test(normalizedLine)) {
    counts.headingCount += sign;
    return;
  }
  if (/^(?:[-*+]|\d+[.)])\s+/.test(normalizedLine)) {
    counts.listItemCount += sign;
  }
}
