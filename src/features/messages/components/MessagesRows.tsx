import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Search from "lucide-react/dist/esm/icons/search";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import { AgentIcon } from "../../../components/AgentIcon";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hydrateClaudeDeferredImage } from "../../../services/tauri";
import { appendMessageRowRenderBudgetDiagnostic } from "../../../services/rendererDiagnostics";
import { trackHotspot } from "../../../services/perfBaseline/hotspotTracker";
import { useRenderHotspot } from "../../../services/perfBaseline/useRenderHotspot";
import {
  createOwnedObjectUrl,
  revokeOwnedObjectUrl,
} from "../../../services/mediaResourceOwners";
import type { ConversationItem, QueuedMessage } from "../../../types";
import { DiffBlock } from "../../git/components/DiffBlock";
import type { StreamActivityPhase } from "../../threads/hooks/useStreamActivityPhase";
import { useLiveAssistantText } from "../../threads/hooks/useLiveAssistantText";
import { isLiveTextExternalizationEnabled } from "../../threads/utils/realtimePerfFlags";
import {
  noteThreadLiveRowRenderMeasured,
  type StreamMitigationProfile,
} from "../../threads/utils/streamLatencyDiagnostics";
import { ProxyStatusBadge } from "../../../components/ProxyStatusBadge";
import { EngineTaskOutputInspector } from "../../engine-task-output/components/EngineTaskOutputInspector";
import { useEngineTaskOutputSnapshot } from "../../engine-task-output/hooks/useEngineTaskOutputSnapshot";
import type { EngineTaskOutputSnapshot } from "../../engine-task-output/types";
import {
  buildEngineTaskOutputSnapshot,
  buildTaskOutputSourceFromNotification,
} from "../../engine-task-output/utils/engineTaskOutputProjection";
import { languageFromPath } from "../../../utils/syntax";
import type { PresentationProfile } from "../presentation/presentationProfile";
import { parseAgentTaskNotification } from "../utils/agentTaskNotification";
import {
  BrowserContextSummaryCard,
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "../../browser-agent";
import {
  CollapsibleUserTextBlock,
  parseUserTextContent,
  UserCodeAnnotationContextBlock,
} from "./CollapsibleUserTextBlock";
import { ImageLightbox, MessageImageGrid, type MessageImage } from "./MessageMediaBlocks";
import { LocalImage } from "./LocalImage";
import { Markdown } from "./Markdown";
import {
  parseIntentCanvasContextSummaries,
} from "../../intent-canvas/utils/messageContext";
import { IntentCanvasContextSummaryCard } from "./IntentCanvasContextSummaryCard";
import { NoteCardContextSummaryCard } from "./NoteCardContextSummaryCard";
import { parseMemoryContextSummary } from "./messagesMemoryContext";
import {
  parseNoteCardContextSummary,
} from "./messagesNoteCardContext";
import { parseReasoning } from "./messagesReasoning";
import {
  analyzeStreamingMarkdownComplexity,
  analyzeStreamingMarkdownComplexityDelta,
  EMPTY_STREAMING_MARKDOWN_COMPLEXITY,
  resolveAssistantMessageStreamingThrottleMs,
  resolveReasoningStreamingThrottleMs,
  shouldUseStagedStreamingMarkdown,
  type StreamingMarkdownComplexity,
} from "./messagesStreamingComplexity";
import { resolveUserMessagePresentation } from "./messagesUserPresentation";
import { RuntimeReconnectCard } from "./RuntimeReconnectCard";
import {
  resolveAssistantRuntimeReconnectHint,
  type RuntimeReconnectRecoveryCallbackResult,
} from "./runtimeReconnect";
import {
  basenameFromPath,
  formatDurationMs,
  MessagesEngine,
  normalizeAgentTaskStatus,
  normalizeMessageImageSrc,
  OPENCODE_NON_STREAMING_HINT_DELAY_MS,
  resolveAgentTaskDisplaySummary,
  shouldDisplayWorkingActivityLabel,
} from "./messagesRenderUtils";

type WorkingIndicatorProps = {
  isThinking: boolean;
  proxyEnabled?: boolean;
  proxyUrl?: string | null;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  heartbeatPulse?: number;
  hasItems: boolean;
  reasoningLabel?: string | null;
  activityLabel?: string | null;
  activeEngine?: MessagesEngine;
  waitingForFirstChunk?: boolean;
  presentationProfile?: PresentationProfile | null;
  streamActivityPhase?: StreamActivityPhase;
  primaryLabel?: string | null;
};

type MessageRowProps = {
  item: Extract<ConversationItem, { kind: "message" }>;
  workspaceId?: string | null;
  threadId?: string | null;
  isStreaming?: boolean;
  activeEngine?: MessagesEngine;
  activeCollaborationModeId?: string | null;
  enableCollaborationBadge?: boolean;
  presentationProfile?: PresentationProfile | null;
  showRuntimeReconnectCard?: boolean;
  onRecoverThreadRuntime?: (
    workspaceId: string,
    threadId: string,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onRecoverThreadRuntimeAndResend?: (
    workspaceId: string,
    threadId: string,
    message: Pick<QueuedMessage, "text" | "images">,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onThreadRecoveryFork?: () => Promise<void> | void;
  retryMessage?: Pick<QueuedMessage, "text" | "images"> | null;
  isCopied?: boolean;
  onCopy?: (
    item: Extract<ConversationItem, { kind: "message" }>,
    copyText?: string,
  ) => void;
  userActionNode?: ReactNode;
  codeBlockCopyUseModifier?: boolean;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  streamMitigationProfile?: StreamMitigationProfile | null;
  onAssistantVisibleTextRender?: (payload: {
    itemId: string;
    visibleText: string;
  }) => void;
  suppressMemorySummaryCard?: boolean;
  suppressNoteCardSummaryCard?: boolean;
  onOutlineReady?: (outline: import("../../markdown/fastMarkdownRenderer").MarkdownOutlineEntry[]) => void;
};

type DeferredImageState = {
  status: "idle" | "loading" | "loaded" | "error";
  src?: string;
  transient?: boolean;
  error?: string;
};

const EMPTY_DEFERRED_IMAGE_ITEMS: NonNullable<
  Extract<ConversationItem, { kind: "message" }>["deferredImages"]
> = [];

function deferredImageKey(
  image: NonNullable<Extract<ConversationItem, { kind: "message" }>["deferredImages"]>[number],
) {
  const locator = image.locator;
  return [
    locator.sessionId,
    locator.lineIndex,
    locator.blockIndex,
    locator.messageId ?? "",
    locator.mediaType,
  ].join(":");
}

function formatDeferredImageSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "unknown size";
  }
  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
  }
  if (byteSize >= 1024) {
    return `${Math.round(byteSize / 1024)} KB`;
  }
  return `${Math.round(byteSize)} B`;
}

function isTransientImageObjectUrl(src: string | undefined, transient: boolean | undefined) {
  return Boolean(transient && src?.startsWith("blob:"));
}

function revokeDeferredImageState(state: DeferredImageState | undefined) {
  const objectUrl = isTransientImageObjectUrl(state?.src, state?.transient)
    ? state?.src
    : null;
  if (objectUrl) {
    revokeOwnedObjectUrl(objectUrl);
  }
}

async function createTransientImageObjectUrl(dataUrl: string) {
  if (!dataUrl.toLowerCase().startsWith("data:image/")) {
    return { src: dataUrl, transient: false };
  }
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return {
      src: createOwnedObjectUrl(blob, {
        ownerId: "message-deferred-image",
      }),
      transient: true,
    };
  } catch {
    return { src: dataUrl, transient: false };
  }
}

type ReasoningRowProps = {
  item: Extract<ConversationItem, { kind: "reasoning" }>;
  workspaceId?: string | null;
  parsed: ReturnType<typeof parseReasoning>;
  isExpanded: boolean;
  isLive: boolean;
  activeEngine?: MessagesEngine;
  onToggle: (id: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  presentationProfile?: PresentationProfile | null;
  streamMitigationProfile?: StreamMitigationProfile | null;
};

type ReviewRowProps = {
  item: Extract<ConversationItem, { kind: "review" }>;
  workspaceId?: string | null;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
};

type DiffRowProps = {
  item: Extract<ConversationItem, { kind: "diff" }>;
};

type ExploreRowProps = {
  item: Extract<ConversationItem, { kind: "explore" }>;
  isExpanded: boolean;
  onToggle: (id: string) => void;
};

type GeneratedImageRowProps = {
  item: Extract<ConversationItem, { kind: "generatedImage" }>;
  workspaceId?: string | null;
};

type MemoryPayloadPackView = {
  source: string;
  count: number;
  cleanedContext: string;
  rawPayload: string;
};

function areMessageImagesEqual(
  previous: Extract<ConversationItem, { kind: "message" }>["images"],
  next: Extract<ConversationItem, { kind: "message" }>["images"],
) {
  if (previous === next) {
    return true;
  }
  if (!previous?.length && !next?.length) {
    return true;
  }
  if (!previous || !next || previous.length !== next.length) {
    return false;
  }
  return previous.every((image, index) => image === next[index]);
}

function areDeferredMessageImagesEqual(
  previous: Extract<ConversationItem, { kind: "message" }>["deferredImages"],
  next: Extract<ConversationItem, { kind: "message" }>["deferredImages"],
) {
  if (previous === next) {
    return true;
  }
  if (!previous?.length && !next?.length) {
    return true;
  }
  if (!previous || !next || previous.length !== next.length) {
    return false;
  }
  return previous.every((image, index) => {
    const nextImage = next[index];
    return (
      nextImage?.workspacePath === image.workspacePath &&
      nextImage.mediaType === image.mediaType &&
      nextImage.estimatedByteSize === image.estimatedByteSize &&
      nextImage.reason === image.reason &&
      nextImage.locator.sessionId === image.locator.sessionId &&
      nextImage.locator.lineIndex === image.locator.lineIndex &&
      nextImage.locator.blockIndex === image.locator.blockIndex &&
      nextImage.locator.messageId === image.locator.messageId &&
      nextImage.locator.mediaType === image.locator.mediaType
    );
  });
}

function areMessageItemsEqual(
  previous: Extract<ConversationItem, { kind: "message" }>,
  next: Extract<ConversationItem, { kind: "message" }>,
) {
  return (
    previous === next ||
    (
      previous.id === next.id &&
      previous.role === next.role &&
      previous.text === next.text &&
      previous.engineSource === next.engineSource &&
      previous.isFinal === next.isFinal &&
      previous.finalCompletedAt === next.finalCompletedAt &&
      previous.finalDurationMs === next.finalDurationMs &&
      previous.selectedAgentName === next.selectedAgentName &&
      previous.selectedAgentIcon === next.selectedAgentIcon &&
      areMessageImagesEqual(previous.images, next.images) &&
      areDeferredMessageImagesEqual(previous.deferredImages, next.deferredImages)
    )
  );
}

function readHighResolutionNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function areMessageRowPropsEqual(
  previous: MessageRowProps,
  next: MessageRowProps,
) {
  const compareStreamingOnlyProps =
    previous.isStreaming === true || next.isStreaming === true;
  const compareRuntimeReconnectProps =
    previous.showRuntimeReconnectCard === true || next.showRuntimeReconnectCard === true;
  return (
    areMessageItemsEqual(previous.item, next.item) &&
    previous.workspaceId === next.workspaceId &&
    previous.threadId === next.threadId &&
    previous.isStreaming === next.isStreaming &&
    previous.activeEngine === next.activeEngine &&
    previous.activeCollaborationModeId === next.activeCollaborationModeId &&
    previous.enableCollaborationBadge === next.enableCollaborationBadge &&
    previous.presentationProfile === next.presentationProfile &&
    previous.showRuntimeReconnectCard === next.showRuntimeReconnectCard &&
    previous.userActionNode === next.userActionNode &&
    (
      !compareRuntimeReconnectProps ||
      (
        previous.onRecoverThreadRuntime === next.onRecoverThreadRuntime &&
        previous.onRecoverThreadRuntimeAndResend === next.onRecoverThreadRuntimeAndResend &&
        previous.onThreadRecoveryFork === next.onThreadRecoveryFork &&
        previous.retryMessage?.text === next.retryMessage?.text &&
        areMessageImagesEqual(previous.retryMessage?.images, next.retryMessage?.images)
      )
    ) &&
    previous.codeBlockCopyUseModifier === next.codeBlockCopyUseModifier &&
    previous.onOpenFileLink === next.onOpenFileLink &&
    previous.onOpenFileLinkMenu === next.onOpenFileLinkMenu &&
    previous.onOutlineReady === next.onOutlineReady &&
    (
      !compareStreamingOnlyProps ||
      (
        previous.streamMitigationProfile === next.streamMitigationProfile &&
        previous.onAssistantVisibleTextRender === next.onAssistantVisibleTextRender
      )
    ) &&
    previous.suppressMemorySummaryCard === next.suppressMemorySummaryCard &&
    previous.suppressNoteCardSummaryCard === next.suppressNoteCardSummaryCard
  );
}

function shouldUsePlainTextStreamingSurface(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  mitigationProfile: StreamMitigationProfile | null | undefined,
) {
  return (
    item.role === "assistant" &&
    isStreaming &&
    activeEngine !== "codex" &&
    mitigationProfile?.renderPlainTextWhileStreaming === true
  );
}

/**
 * staged streaming 引擎（claude / codex）的流式 assistant 消息自首个非空 token
 * 起统一走 lightweight markdown。历史上早期阶段（<260 chars 且非结构化）仍走
 * full react-markdown，每次 48ms throttled 更新都触发全量重解析 + Prism 同步
 * 高亮，是对话页 5 FPS / 单组件 225ms 的主因之一；settle 后由 full markdown
 * 渲染最终内容，视觉结果不变。
 */
// A4 流式正文外部化（docs/perf/a4-live-text-externalization-plan.md）：
// 模块加载时读一次 flag，翻转需刷新页面（与其余 perf flag 同语义）。
const LIVE_TEXT_EXTERNALIZATION_ENABLED = isLiveTextExternalizationEnabled();

function shouldUseLightweightStreamingMarkdown(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  presentationProfile: PresentationProfile | null | undefined,
  complexity: StreamingMarkdownComplexity,
) {
  if (item.role !== "assistant" || !isStreaming) {
    return false;
  }
  const useStagedMarkdownThrottle = shouldUseStagedStreamingMarkdown(
    activeEngine,
    presentationProfile,
  );
  if (!useStagedMarkdownThrottle) {
    return false;
  }
  return complexity.trimmedText.length > 0;
}

function shouldUseLongFoldedMarkdownStreamingSurface(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  text: string,
) {
  return (
    item.role === "assistant" &&
    isStreaming &&
    activeEngine === "claude" &&
    text.length > STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD
  );
}

const STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD = 20_000;
const STREAMING_PLAIN_TEXT_HEAD_CHARS = 4_000;
const STREAMING_PLAIN_TEXT_TAIL_CHARS = 2_000;

function resolveStreamingPlainTextCollapsedView({
  text,
  omittedChars,
  marker,
}: {
  text: string;
  omittedChars: number;
  marker: string;
}) {
  if (text.length <= STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD) {
    return text;
  }
  if (omittedChars <= 0) {
    return text;
  }
  return [
    text.slice(0, STREAMING_PLAIN_TEXT_HEAD_CHARS),
    `\n\n${marker}\n\n`,
    text.slice(-STREAMING_PLAIN_TEXT_TAIL_CHARS),
  ].join("");
}

function areGeneratedImageItemsEqual(
  previous: Extract<ConversationItem, { kind: "generatedImage" }>,
  next: Extract<ConversationItem, { kind: "generatedImage" }>,
) {
  if (previous === next) {
    return true;
  }
  if (
    previous.id !== next.id ||
    previous.status !== next.status ||
    previous.promptText !== next.promptText ||
    previous.fallbackText !== next.fallbackText ||
    previous.anchorUserMessageId !== next.anchorUserMessageId ||
    previous.images.length !== next.images.length
  ) {
    return false;
  }
  return previous.images.every((image, index) => {
    const nextImage = next.images[index];
    return (
      nextImage?.src === image.src &&
      nextImage.localPath === image.localPath
    );
  });
}

function normalizeNoteCardImageIdentity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const hasWindowsDrivePrefix = (candidate: string) => /^[A-Za-z][:|][\\/]/.test(candidate);
  const hasWindowsDriveHost = (candidate: string) => /^[A-Za-z][:|]/.test(candidate);
  const decodePath = (candidate: string) => {
    try {
      return decodeURIComponent(candidate);
    } catch {
      return candidate;
    }
  };

  let withoutFileScheme = trimmed;
  const lowerCased = trimmed.toLowerCase();
  if (lowerCased.startsWith("asset://localhost")) {
    withoutFileScheme = trimmed.slice("asset://localhost".length);
    if (!withoutFileScheme.startsWith("/")) {
      withoutFileScheme = `/${withoutFileScheme}`;
    }
    if (withoutFileScheme.startsWith("//")) {
      withoutFileScheme = withoutFileScheme.slice(1);
    }
    withoutFileScheme = decodePath(withoutFileScheme);
  } else if (lowerCased.startsWith("file://")) {
    const remainder = trimmed.slice("file://".length).trim();
    if (!remainder) {
      return "";
    }
    if (/^localhost\//i.test(remainder)) {
      withoutFileScheme = decodePath(remainder.replace(/^localhost\//i, ""));
    } else if (
      !remainder.startsWith("/")
      && !hasWindowsDrivePrefix(remainder)
      && !hasWindowsDriveHost(remainder)
    ) {
      const slashIndex = remainder.indexOf("/");
      if (slashIndex === -1) {
        withoutFileScheme = `//${remainder}`;
      } else {
        const host = remainder.slice(0, slashIndex);
        const tail = remainder.slice(slashIndex);
        withoutFileScheme = `//${host}${decodePath(tail)}`;
      }
    } else {
      withoutFileScheme = decodePath(remainder.replace(/\|/g, ":"));
    }
    if (
      !withoutFileScheme.startsWith("/")
      && !hasWindowsDrivePrefix(withoutFileScheme)
      && !hasWindowsDriveHost(withoutFileScheme)
    ) {
      withoutFileScheme = `/${withoutFileScheme}`;
    }
  }
  const normalized = withoutFileScheme.replace(/\\/g, "/");
  if (/^\/[A-Za-z]:\//.test(normalized)) {
    return normalized.slice(1).toLowerCase();
  }
  if (/^[A-Za-z]:\//.test(normalized)) {
    return normalized.toLowerCase();
  }
  return normalized;
}

export const WorkingIndicator = memo(function WorkingIndicator({
  isThinking,
  proxyEnabled = false,
  proxyUrl = null,
  processingStartedAt = null,
  lastDurationMs = null,
  heartbeatPulse = 0,
  hasItems,
  reasoningLabel = null,
  activityLabel = null,
  activeEngine = "claude",
  waitingForFirstChunk = false,
  presentationProfile = null,
  streamActivityPhase = "idle",
  primaryLabel = null,
}: WorkingIndicatorProps) {
  const { t } = useTranslation();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isThinking || !processingStartedAt) {
      setElapsedMs(0);
      return undefined;
    }
    setElapsedMs(Date.now() - processingStartedAt);
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - processingStartedAt);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isThinking, processingStartedAt]);

  const showNonStreamingHint =
    (presentationProfile?.heartbeatWaitingHint ?? activeEngine === "opencode") &&
    isThinking &&
    waitingForFirstChunk &&
    elapsedMs >= OPENCODE_NON_STREAMING_HINT_DELAY_MS;
  const showActivityLabel = shouldDisplayWorkingActivityLabel(
    reasoningLabel,
    activityLabel,
  );
  const supportsStreamActivityPhaseFx =
    activeEngine === "codex" || activeEngine === "claude" || activeEngine === "gemini";
  const visualStreamActivityPhase =
    activeEngine === "codex" && streamActivityPhase === "ingress"
      ? "waiting"
      : streamActivityPhase;
  const streamPhaseClass =
    supportsStreamActivityPhaseFx && visualStreamActivityPhase !== "idle"
      ? ` is-${visualStreamActivityPhase}`
      : "";
  const nonStreamingHintText = t("messages.nonStreamingHint");
  const resolvedNonStreamingHint =
    nonStreamingHintText === "messages.nonStreamingHint"
      ? "This model may return non-streaming output, or the network may be unreachable. Please wait..."
      : nonStreamingHintText;
  const heartbeatHints = useMemo(() => {
    const keys = [
      "messages.opencodeHeartbeatHint1",
      "messages.opencodeHeartbeatHint2",
      "messages.opencodeHeartbeatHint3",
      "messages.opencodeHeartbeatHint4",
      "messages.opencodeHeartbeatHint5",
    ];
    const translated = keys
      .map((key) => t(key))
      .filter((value, index) => value !== keys[index]);
    if (translated.length > 0) {
      return translated;
    }
    return [resolvedNonStreamingHint];
  }, [resolvedNonStreamingHint, t]);
  const [heartbeatHintText, setHeartbeatHintText] = useState("");
  const heartbeatStateRef = useRef<{ lastPulse: number; lastIndex: number }>({
    lastPulse: 0,
    lastIndex: -1,
  });

  useEffect(() => {
    if (!showNonStreamingHint) {
      heartbeatStateRef.current = { lastPulse: 0, lastIndex: -1 };
      setHeartbeatHintText("");
      return;
    }
    if (heartbeatPulse <= 0 || heartbeatPulse === heartbeatStateRef.current.lastPulse) {
      return;
    }
    heartbeatStateRef.current.lastPulse = heartbeatPulse;
    let randomIndex = Math.floor(Math.random() * heartbeatHints.length);
    if (heartbeatHints.length > 1 && randomIndex === heartbeatStateRef.current.lastIndex) {
      randomIndex = (randomIndex + 1) % heartbeatHints.length;
    }
    heartbeatStateRef.current.lastIndex = randomIndex;
    const pulseText = t("messages.opencodeHeartbeatPulse", {
      pulse: heartbeatPulse,
      hint: heartbeatHints[randomIndex],
    });
    setHeartbeatHintText(
      pulseText === "messages.opencodeHeartbeatPulse"
        ? `Heartbeat ${heartbeatPulse}: ${heartbeatHints[randomIndex]}`
        : pulseText,
    );
  }, [heartbeatHints, heartbeatPulse, showNonStreamingHint, t]);

  return (
    <>
      {isThinking && (
        <div className={`working${streamPhaseClass}`}>
          {proxyEnabled && (
            <ProxyStatusBadge
              proxyUrl={proxyUrl}
              label={t("messages.proxyBadge")}
              variant="prominent"
              animated
              className="working-proxy-badge"
            />
          )}
          <span className="working-spinner" aria-hidden />
          <div className="working-timer">
            <span className="working-timer-clock">{formatDurationMs(elapsedMs)}</span>
          </div>
          <span className="working-text">
            {primaryLabel || reasoningLabel || t("messages.generatingResponse")}
          </span>
          {showActivityLabel && <span className="working-activity">{activityLabel}</span>}
          {showNonStreamingHint && (
            <span className="working-hint">
              {heartbeatHintText || resolvedNonStreamingHint}
            </span>
          )}
        </div>
      )}
      {!isThinking && lastDurationMs !== null && hasItems && (
        <div className="turn-complete" aria-live="polite">
          <span className="turn-complete-line" aria-hidden />
          <span className="turn-complete-label">
            {t("messages.doneIn", { duration: formatDurationMs(lastDurationMs) })}
          </span>
          <span className="turn-complete-line" aria-hidden />
        </div>
      )}
    </>
  );
});

export const MessageRow = memo(function MessageRow({
  item,
  workspaceId = null,
  threadId = null,
  isStreaming = false,
  activeEngine = "claude",
  enableCollaborationBadge = false,
  presentationProfile = null,
  showRuntimeReconnectCard = false,
  onRecoverThreadRuntime,
  onRecoverThreadRuntimeAndResend,
  onThreadRecoveryFork,
  retryMessage = null,
  userActionNode = null,
  codeBlockCopyUseModifier,
  onOpenFileLink,
  onOpenFileLinkMenu,
  streamMitigationProfile = null,
  onAssistantVisibleTextRender,
  suppressMemorySummaryCard = false,
  suppressNoteCardSummaryCard = false,
  onOutlineReady,
}: MessageRowProps) {
  const renderStartedAtMs = readHighResolutionNowMs();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const { t } = useTranslation();
  const lastLongLiveRenderDiagnosticRef = useRef<{
    itemId: string;
    textLength: number;
  }>({ itemId: "", textLength: 0 });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deferredImageStates, setDeferredImageStates] = useState<Record<string, DeferredImageState>>({});
  const deferredImageObjectUrlsRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);
  const [memorySummaryExpanded, setMemorySummaryExpanded] = useState(false);
  const [memoryPayloadDialogOpen, setMemoryPayloadDialogOpen] = useState(false);
  const [isAgentBadgeExpanded, setIsAgentBadgeExpanded] = useState(false);
  const [inspectedTaskOutput, setInspectedTaskOutput] =
    useState<EngineTaskOutputSnapshot | null>(null);
  const inspectedTaskOutputState = useEngineTaskOutputSnapshot({
    workspaceId,
    snapshot: inspectedTaskOutput,
  });
  useEffect(() => {
    if (!memoryPayloadDialogOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMemoryPayloadDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [memoryPayloadDialogOpen]);
  const userMessagePresentation = useMemo(
    () => (
      item.role === "user"
        ? resolveUserMessagePresentation({
            text: item.text,
            selectedAgentName: item.selectedAgentName,
            selectedAgentIcon: item.selectedAgentIcon,
            enableCollaborationBadge,
          })
        : null
    ),
    [
      enableCollaborationBadge,
      item.role,
      item.selectedAgentIcon,
      item.selectedAgentName,
      item.text,
    ],
  );
  const memorySummary = useMemo(
    () =>
      item.role === "assistant"
        ? parseMemoryContextSummary(item.text)
        : userMessagePresentation?.memorySummary ?? null,
    [item.role, item.text, userMessagePresentation?.memorySummary],
  );
  const noteCardSummary = useMemo(
    () =>
      item.role === "assistant"
        ? parseNoteCardContextSummary(item.text)
        : userMessagePresentation?.noteCardSummary ?? null,
    [item.role, item.text, userMessagePresentation?.noteCardSummary],
  );
  const resolvedMemorySummary = suppressMemorySummaryCard ? null : memorySummary;
  const resolvedNoteCardSummary = suppressNoteCardSummaryCard ? null : noteCardSummary;
  const memorySummaryRecords = resolvedMemorySummary?.records ?? [];
  const memorySummaryRawPayload = resolvedMemorySummary?.rawPayload?.trim() ?? "";
  const memoryPayloadPacks: MemoryPayloadPackView[] =
    resolvedMemorySummary?.memoryPacks ?? [];
  const agentTaskNotification = useMemo(
    () => parseAgentTaskNotification(item.text),
    [item.text],
  );
  const browserContextSummary = useMemo(() => {
    if (item.role !== "user") {
      return null;
    }
    return item.browserContextAttachment ?? parseBrowserContextPrompt(item.text);
  }, [item]);
  const intentCanvasContextSummary = useMemo(() => {
    if (item.role !== "user") {
      return null;
    }
    const attachedSummaries = item.intentCanvasContextAttachments ?? [];
    if (attachedSummaries.length > 0) {
      return attachedSummaries;
    }
    return parseIntentCanvasContextSummaries(item.text);
  }, [item.intentCanvasContextAttachments, item.role, item.text]);
  const shouldHideSuppressedInjectedContextText =
    item.role === "user" &&
    !agentTaskNotification &&
    (
      (
        suppressMemorySummaryCard &&
        Boolean(userMessagePresentation?.memorySummary) &&
        (userMessagePresentation?.stickyCandidateText ?? "").trim().length === 0
      ) ||
      (
        suppressNoteCardSummaryCard &&
        Boolean(userMessagePresentation?.noteCardSummary) &&
        (userMessagePresentation?.stickyCandidateText ?? "").trim().length === 0
      )
    );
  // A4 live-text 外部化：流式中的 assistant 行订阅 liveAssistantTextChannel
  // （通道自首条 delta 起全量累计，item.text 仅为建壳首段），后续 delta 只驱动
  // 本行小树渲染。非流式行/flag 关闭时订阅为空、零开销；终稿落地或中断 drain
  // 后通道条目清除，本行自然切回读 item.text。
  const liveAssistantTextEntry = useLiveAssistantText(
    threadId,
    LIVE_TEXT_EXTERNALIZATION_ENABLED && isStreaming && item.role === "assistant",
  );
  const liveAssistantText =
    liveAssistantTextEntry && isStreaming && item.role === "assistant"
      ? liveAssistantTextEntry.text
      : null;
  const displayText = agentTaskNotification
    ? agentTaskNotification.resultText
    : item.role === "user"
      ? (
          shouldHideSuppressedInjectedContextText
            ? ""
            : stripBrowserContextPrompt(userMessagePresentation?.displayText ?? item.text)
        )
      : resolvedMemorySummary || resolvedNoteCardSummary
        ? ""
        : liveAssistantText ?? item.text;
  const messageRowSubtype = agentTaskNotification
    ? "agent-task"
    : item.role === "assistant"
      ? "assistant"
      : "user";
  // 流式 delta 到达时的紧急渲染先复用上一帧文本（memo 全部命中、DOM 不变，
  // 几乎零开销），昂贵的 markdown/复杂度计算被推到后台的 deferred 渲染中，
  // 避免每个 token 都同步阻塞主线程。非流式或历史消息文本不变，等价于直通。
  const deferredDisplayText = useDeferredValue(displayText);
  const streamingDisplayText =
    item.role === "assistant" && isStreaming ? deferredDisplayText : displayText;
  useEffect(() => {
    appendMessageRowRenderBudgetDiagnostic({
      threadId,
      itemId: item.id,
      role: item.role,
      subtype: messageRowSubtype,
      evidenceKind: "proxy",
      renderCount: renderCountRef.current,
      isStreaming,
      textLength: displayText.length,
    });
  });
  useRenderHotspot(
    "message-row-render",
    `${messageRowSubtype}:${displayText.length}ch:${isStreaming ? "stream" : "idle"}`,
    isStreaming,
  );
  const selectedAgentName = userMessagePresentation?.selectedAgentName ?? null;
  const selectedAgentIcon = userMessagePresentation?.selectedAgentIcon ?? null;
  const hasInjectedAgentPromptBlock =
    userMessagePresentation?.hasInjectedAgentPromptBlock ?? false;
  const hasExternalAgentBadge =
    item.role === "user"
    && !agentTaskNotification
    && (Boolean(selectedAgentName) || hasInjectedAgentPromptBlock);
  const agentTaskDisplay = useMemo(() => {
    if (!agentTaskNotification) {
      return null;
    }
    return {
      ...resolveAgentTaskDisplaySummary(agentTaskNotification.summary),
      status: normalizeAgentTaskStatus(agentTaskNotification.status),
      outputFileName: basenameFromPath(agentTaskNotification.outputFile),
    };
  }, [agentTaskNotification]);
  const agentTaskOutputSnapshot = useMemo(() => {
    if (!agentTaskNotification || !agentTaskDisplay) {
      return null;
    }
    return buildEngineTaskOutputSnapshot(
      buildTaskOutputSourceFromNotification({
        itemId: item.id,
        engine: activeEngine,
        title: agentTaskDisplay.title,
        notification: agentTaskNotification,
      }),
      null,
    );
  }, [activeEngine, agentTaskDisplay, agentTaskNotification, item.id]);
  useEffect(() => {
    setIsAgentBadgeExpanded(false);
  }, [item.id, selectedAgentIcon, selectedAgentName]);
  useEffect(() => {
    setInspectedTaskOutput(null);
  }, [item.id]);
  const handleToggleAgentBadge = useCallback(() => {
    setIsAgentBadgeExpanded((current) => !current);
  }, []);
  const hasText = displayText.trim().length > 0;
  const parsedUserTextContent = useMemo(
    () => (
      item.role === "user" && !agentTaskNotification && hasText
        ? parseUserTextContent(displayText)
        : null
    ),
    [agentTaskNotification, displayText, hasText, item.role],
  );
  const noteCardImagePathSet = useMemo(
    () =>
      new Set(
        (noteCardSummary?.imagePaths ?? []).map((path) =>
          normalizeNoteCardImageIdentity(path),
        ),
      ),
    [noteCardSummary?.imagePaths],
  );
  const imageItems = useMemo(() => {
    if (!item.images || item.images.length === 0) {
      return [];
    }
    return item.images
      .filter((image) => !noteCardImagePathSet.has(normalizeNoteCardImageIdentity(image)))
      .map((image, index) => {
        const src = normalizeMessageImageSrc(image);
        if (!src) {
          return null;
        }
        return { src, label: `Image ${index + 1}` };
      })
      .filter(Boolean) as MessageImage[];
  }, [item.images, noteCardImagePathSet]);
  const deferredImageItems = item.deferredImages ?? EMPTY_DEFERRED_IMAGE_ITEMS;
  const loadedDeferredImages = useMemo(
    () =>
      deferredImageItems
        .map((image, index) => {
          const state = deferredImageStates[deferredImageKey(image)];
          if (state?.status !== "loaded" || !state.src) {
            return null;
          }
          return { src: state.src, label: `Deferred Claude image ${index + 1}` };
        })
        .filter(Boolean) as MessageImage[],
    [deferredImageItems, deferredImageStates],
  );
  const lightboxImages = useMemo(
    () => [...imageItems, ...loadedDeferredImages],
    [imageItems, loadedDeferredImages],
  );
  const revokeTrackedDeferredImageState = useCallback((state: DeferredImageState | undefined) => {
    const objectUrl = isTransientImageObjectUrl(state?.src, state?.transient)
      ? state?.src ?? null
      : null;
    revokeDeferredImageState(state);
    if (objectUrl) {
      deferredImageObjectUrlsRef.current.delete(objectUrl);
    }
  }, []);
  const handleLoadDeferredImage = useCallback(
    async (
      image: NonNullable<Extract<ConversationItem, { kind: "message" }>["deferredImages"]>[number],
    ) => {
      const key = deferredImageKey(image);
      if (!image.workspacePath) {
        setDeferredImageStates((current) => {
          revokeTrackedDeferredImageState(current[key]);
          return {
            ...current,
            [key]: {
              status: "error",
              error: "Missing workspace path for this Claude image.",
            },
          };
        });
        return;
      }
      setDeferredImageStates((current) => {
        revokeTrackedDeferredImageState(current[key]);
        return {
          ...current,
          [key]: { status: "loading" },
        };
      });
      try {
        const hydrated = await hydrateClaudeDeferredImage(
          image.workspacePath,
          image.locator,
        );
        const transientImage = await createTransientImageObjectUrl(hydrated.src);
        const loadedState: DeferredImageState = {
          status: "loaded",
          src: transientImage.src,
          transient: transientImage.transient,
        };
        const loadedObjectUrl = isTransientImageObjectUrl(
          loadedState.src,
          loadedState.transient,
        )
          ? loadedState.src
          : null;
        if (loadedObjectUrl) {
          deferredImageObjectUrlsRef.current.add(loadedObjectUrl);
        }
        if (!isMountedRef.current) {
          revokeDeferredImageState(loadedState);
          if (loadedObjectUrl) {
            deferredImageObjectUrlsRef.current.delete(loadedObjectUrl);
          }
          return;
        }
        setDeferredImageStates((current) => {
          revokeTrackedDeferredImageState(current[key]);
          return {
            ...current,
            [key]: loadedState,
          };
        });
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }
        setDeferredImageStates((current) => {
          revokeTrackedDeferredImageState(current[key]);
          return {
            ...current,
            [key]: {
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            },
          };
        });
      }
    },
    [revokeTrackedDeferredImageState],
  );
  const deferredImageStatesRef = useRef(deferredImageStates);
  useEffect(() => {
    deferredImageStatesRef.current = deferredImageStates;
  }, [deferredImageStates]);
  useEffect(() => () => {
    isMountedRef.current = false;
    Object.values(deferredImageStatesRef.current).forEach(revokeTrackedDeferredImageState);
    deferredImageObjectUrlsRef.current.forEach((objectUrl) => {
      revokeOwnedObjectUrl(objectUrl);
    });
    deferredImageObjectUrlsRef.current.clear();
  }, [revokeTrackedDeferredImageState]);
  const useStagedMarkdownThrottle = shouldUseStagedStreamingMarkdown(
    activeEngine,
    presentationProfile,
  );
  const resolvedMarkdownClassName = isStreaming
    ? "markdown markdown-live-streaming"
    : "markdown";
  const streamingMarkdownComplexityCacheRef = useRef<{
    value: string;
    complexity: StreamingMarkdownComplexity;
  } | null>(null);
  const streamingMarkdownComplexity = useMemo(
    () => {
      if (
        item.role !== "assistant" ||
        !isStreaming ||
        !useStagedMarkdownThrottle
      ) {
        streamingMarkdownComplexityCacheRef.current = null;
        return EMPTY_STREAMING_MARKDOWN_COMPLEXITY;
      }
      return trackHotspot("markdown-complexity", `${streamingDisplayText.length}ch`, () => {
        const previousCache = streamingMarkdownComplexityCacheRef.current;
        if (previousCache) {
          // chat-stream-render-isolation-2026-06 task 3.1: prefer the delta
          // path when displayText strictly extends the cached prefix, so
          // long streaming bursts avoid re-scanning the full prefix.
          if (streamingDisplayText === previousCache.value) {
            return previousCache.complexity;
          }
          if (streamingDisplayText.startsWith(previousCache.value)) {
            const deltaText = streamingDisplayText.slice(previousCache.value.length);
            const nextComplexity = analyzeStreamingMarkdownComplexityDelta(
              previousCache.complexity,
              previousCache.value,
              deltaText,
            );
            streamingMarkdownComplexityCacheRef.current = {
              value: streamingDisplayText,
              complexity: nextComplexity,
            };
            return nextComplexity;
          }
          if (previousCache.complexity.isHuge) {
            return previousCache.complexity;
          }
        }
        const nextComplexity = analyzeStreamingMarkdownComplexity(streamingDisplayText);
        streamingMarkdownComplexityCacheRef.current = {
          value: streamingDisplayText,
          complexity: nextComplexity,
        };
        return nextComplexity;
      });
    },
    [streamingDisplayText, isStreaming, item.role, useStagedMarkdownThrottle],
  );
  const usePlainTextStreamingSurface = shouldUsePlainTextStreamingSurface(
    item,
    isStreaming,
    activeEngine,
    streamMitigationProfile,
  );
  const useLongFoldedMarkdownStreamingSurface = shouldUseLongFoldedMarkdownStreamingSurface(
    item,
    isStreaming,
    activeEngine,
    streamingDisplayText,
  );
  const useLightweightStreamingMarkdown = !usePlainTextStreamingSurface && (
    useLongFoldedMarkdownStreamingSurface ||
    shouldUseLightweightStreamingMarkdown(
      item,
      isStreaming,
      activeEngine,
      presentationProfile,
      streamingMarkdownComplexity,
    )
  );
  const livePlainTextClassName = `${resolvedMarkdownClassName} markdown-live-plain-text`;
  const streamingPlainTextCollapsedOmittedChars = useMemo(() => {
    if (!useLongFoldedMarkdownStreamingSurface) {
      return 0;
    }
    const omitted = streamingDisplayText.length - (
      STREAMING_PLAIN_TEXT_HEAD_CHARS + STREAMING_PLAIN_TEXT_TAIL_CHARS
    );
    return Math.max(omitted, 0);
  }, [streamingDisplayText.length, useLongFoldedMarkdownStreamingSurface]);
  const liveFoldedStreamingSurfaceText = useMemo(() => {
    if (!useLongFoldedMarkdownStreamingSurface || streamingPlainTextCollapsedOmittedChars <= 0) {
      return streamingDisplayText;
    }
    return resolveStreamingPlainTextCollapsedView({
      text: streamingDisplayText,
      omittedChars: streamingPlainTextCollapsedOmittedChars,
      marker: t("messages.streamingPlainTextCollapsed", {
        omittedChars: streamingPlainTextCollapsedOmittedChars,
      }),
    });
  }, [streamingDisplayText, streamingPlainTextCollapsedOmittedChars, t, useLongFoldedMarkdownStreamingSurface]);
  const handleRenderedAssistantValue = useCallback(
    (visibleText: string) => {
      if (item.role !== "assistant" || !isStreaming) {
        return;
      }
      onAssistantVisibleTextRender?.({
        itemId: item.id,
        visibleText,
      });
    },
    [isStreaming, item.id, item.role, onAssistantVisibleTextRender],
  );
  const handleMarkdownRenderedAssistantValue = useCallback(
    (visibleText: string) => {
      handleRenderedAssistantValue(
        useLongFoldedMarkdownStreamingSurface ? streamingDisplayText : visibleText,
      );
    },
    [streamingDisplayText, handleRenderedAssistantValue, useLongFoldedMarkdownStreamingSurface],
  );
  useEffect(() => {
    if (!usePlainTextStreamingSurface) {
      return;
    }
    handleRenderedAssistantValue(streamingDisplayText);
  }, [
    streamingDisplayText,
    handleRenderedAssistantValue,
    usePlainTextStreamingSurface,
  ]);
  useEffect(() => {
    if (usePlainTextStreamingSurface || !useLightweightStreamingMarkdown) {
      return;
    }
    handleRenderedAssistantValue(streamingDisplayText);
  }, [
    streamingDisplayText,
    handleRenderedAssistantValue,
    useLightweightStreamingMarkdown,
    usePlainTextStreamingSurface,
  ]);
  useEffect(() => {
    if (
      !threadId ||
      item.role !== "assistant" ||
      !isStreaming ||
      displayText.length <= STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD
    ) {
      return;
    }
    const previousDiagnostic = lastLongLiveRenderDiagnosticRef.current;
    if (
      previousDiagnostic.itemId === item.id &&
      displayText.length - previousDiagnostic.textLength < 2_048
    ) {
      return;
    }
    lastLongLiveRenderDiagnosticRef.current = {
      itemId: item.id,
      textLength: displayText.length,
    };
    noteThreadLiveRowRenderMeasured(threadId, {
      itemId: item.id,
      textLength: displayText.length,
      renderCostMs: readHighResolutionNowMs() - renderStartedAtMs,
    });
  }, [displayText.length, isStreaming, item.id, item.role, renderStartedAtMs, threadId]);
  const runtimeReconnectHint = useMemo(
    () => (
      item.role === "assistant"
        ? resolveAssistantRuntimeReconnectHint(item, Boolean(agentTaskNotification))
        : null
    ),
    [agentTaskNotification, item],
  );
  const showActiveRuntimeReconnectCard =
    Boolean(runtimeReconnectHint) &&
    showRuntimeReconnectCard;
  const suppressRuntimeReconnectText = Boolean(runtimeReconnectHint);
  if (runtimeReconnectHint && !showActiveRuntimeReconnectCard) {
    return null;
  }

  const bubbleNode = (
    <div className={`bubble message-bubble${agentTaskNotification ? " message-bubble-agent-task" : ""}`}>
      {agentTaskNotification && agentTaskDisplay ? (
        <Card className="message-agent-task-card gap-3 rounded-[8px] p-4 before:rounded-[7px]">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary"
              aria-hidden
            >
              <AgentIcon
                seed={agentTaskDisplay.title || agentTaskNotification.taskId || item.id}
                fallback="codicon-hubot"
                className="inline-flex"
                size={18}
              />
            </div>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Agent session
              </span>
              <strong className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
                {agentTaskDisplay.title}
              </strong>
              {agentTaskDisplay.subtitle ? (
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {agentTaskDisplay.subtitle}
                </span>
              ) : null}
            </div>
            <Badge
              variant={
                agentTaskDisplay.status.tone === "completed"
                  ? "success"
                  : agentTaskDisplay.status.tone === "running"
                    ? "info"
                    : agentTaskDisplay.status.tone === "error"
                      ? "error"
                      : "secondary"
              }
              className="shrink-0 uppercase"
            >
              {agentTaskDisplay.status.label}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agentTaskNotification.taskId ? (
              <Badge variant="secondary" className="max-w-full truncate font-normal">
                task {agentTaskNotification.taskId}
              </Badge>
            ) : null}
            {agentTaskNotification.toolUseId ? (
              <Badge variant="secondary" className="max-w-full truncate font-normal">
                tool {agentTaskNotification.toolUseId}
              </Badge>
            ) : null}
            {agentTaskDisplay.outputFileName ? (
              <Badge variant="secondary" className="max-w-full truncate font-normal">
                {agentTaskDisplay.outputFileName}
              </Badge>
            ) : null}
          </div>
          {agentTaskOutputSnapshot ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setInspectedTaskOutput(agentTaskOutputSnapshot)}
            >
              {t("engineTaskOutput.inspect")}
            </Button>
          ) : null}
          {inspectedTaskOutput ? (
            <div className="mt-1">
              <EngineTaskOutputInspector
                snapshot={inspectedTaskOutputState.snapshot ?? inspectedTaskOutput}
                refreshState={inspectedTaskOutputState.refreshState}
                onRefresh={inspectedTaskOutputState.refresh}
                onClose={() => setInspectedTaskOutput(null)}
                className="border-border/60 bg-muted/30 shadow-none before:hidden"
              />
            </div>
          ) : null}
        </Card>
      ) : null}
      {imageItems.length > 0 && (
        <MessageImageGrid
          images={imageItems}
          onOpen={setLightboxIndex}
          hasText={hasText}
        />
      )}
      {deferredImageItems.length > 0 ? (
        <div className="message-deferred-image-list" role="list">
          {deferredImageItems.map((image, index) => {
            const key = deferredImageKey(image);
            const state = deferredImageStates[key] ?? { status: "idle" };
            return (
              <div
                key={key}
                className={`message-deferred-image is-${state.status}`}
                role="listitem"
              >
                {state.status === "loaded" && state.src ? (
                  <button
                    type="button"
                    className="message-deferred-image-preview"
                    onClick={() => {
                      const lightboxTarget = lightboxImages.findIndex(
                        (entry) => entry.src === state.src,
                      );
                      if (lightboxTarget >= 0) {
                        setLightboxIndex(lightboxTarget);
                      }
                    }}
                    aria-label={`Open image ${index + 1}`}
                  >
                    <img src={state.src} alt={`Deferred Claude image ${index + 1}`} loading="lazy" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="message-deferred-image-placeholder"
                      onClick={() => void handleLoadDeferredImage(image)}
                      disabled={state.status === "loading"}
                      aria-label="Load image"
                      title={`${image.mediaType} · ${formatDeferredImageSize(image.estimatedByteSize)}`}
                    >
                      <span className="message-deferred-image-icon" aria-hidden="true">
                        {state.status === "loading" ? (
                          <LoaderCircle size={18} className="message-deferred-image-spinner" />
                        ) : (
                          <RefreshCw size={18} />
                        )}
                      </span>
                      <span className="sr-only">Claude history image available on demand</span>
                    </button>
                    {state.status === "error" && state.error ? (
                      <span className="message-deferred-image-error">{state.error}</span>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {runtimeReconnectHint && showActiveRuntimeReconnectCard ? (
        <RuntimeReconnectCard
          hint={runtimeReconnectHint}
          workspaceId={workspaceId}
          threadId={threadId}
          onRecoverThreadRuntime={onRecoverThreadRuntime}
          retryMessage={retryMessage}
          onRecoverThreadRuntimeAndResend={onRecoverThreadRuntimeAndResend}
          onThreadRecoveryFork={onThreadRecoveryFork}
        />
      ) : null}
      {hasText && (
        item.role === "user" && !agentTaskNotification ? (
          <CollapsibleUserTextBlock
            content={displayText}
            parsedContent={parsedUserTextContent ?? undefined}
          />
        ) : suppressRuntimeReconnectText ? null : usePlainTextStreamingSurface ? (
          <div className={livePlainTextClassName}>
            {useLongFoldedMarkdownStreamingSurface ? liveFoldedStreamingSurfaceText : streamingDisplayText}
          </div>
        ) : (
          <Markdown
            value={useLongFoldedMarkdownStreamingSurface ? liveFoldedStreamingSurfaceText : streamingDisplayText}
            className={resolvedMarkdownClassName}
            workspaceId={workspaceId}
            codeBlockStyle="message"
            codeBlockCopyUseModifier={codeBlockCopyUseModifier}
            streamingThrottleMs={resolveAssistantMessageStreamingThrottleMs(
              item,
              isStreaming,
              activeEngine,
              streamMitigationProfile,
              presentationProfile,
              streamingMarkdownComplexity,
            )}
            onOpenFileLink={onOpenFileLink}
            onOpenFileLinkMenu={onOpenFileLinkMenu}
            liveRenderMode={useLightweightStreamingMarkdown ? "lightweight" : "full"}
            progressiveReveal={
              useLightweightStreamingMarkdown && streamingMarkdownComplexity.isMedium
            }
            onRenderedValueChange={handleMarkdownRenderedAssistantValue}
            onOutlineReady={isStreaming ? undefined : onOutlineReady}
          />
        )
      )}
      {item.role === "user" && !agentTaskNotification ? userActionNode : null}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
  const codeAnnotationContextNode =
    parsedUserTextContent && parsedUserTextContent.codeAnnotations.length > 0 ? (
      <UserCodeAnnotationContextBlock annotations={parsedUserTextContent.codeAnnotations} />
    ) : null;
  const noteCardSummaryNode = resolvedNoteCardSummary ? (
    <NoteCardContextSummaryCard
      summary={resolvedNoteCardSummary}
      workspaceId={workspaceId}
      codeBlockCopyUseModifier={codeBlockCopyUseModifier}
      onOpenFileLink={onOpenFileLink}
      onOpenFileLinkMenu={onOpenFileLinkMenu}
    />
  ) : null;
  const browserContextSummaryNode = browserContextSummary ? (
    <BrowserContextSummaryCard attachment={browserContextSummary} />
  ) : null;
  const intentCanvasContextSummaryNode =
    intentCanvasContextSummary && intentCanvasContextSummary.length > 0 ? (
      <>
        {intentCanvasContextSummary.map((summary) => (
          <IntentCanvasContextSummaryCard
            key={summary.attachmentId}
            summary={summary}
          />
        ))}
      </>
    ) : null;
  const shouldRenderBubble =
    agentTaskNotification
    || imageItems.length > 0
    || deferredImageItems.length > 0
    || showActiveRuntimeReconnectCard
    || (hasText && !suppressRuntimeReconnectText);
  const memoryPayloadDialogNode =
    memoryPayloadDialogOpen && memorySummaryRawPayload && typeof document !== "undefined"
      ? createPortal(
        <div
          className="memory-context-payload-dialog-overlay"
          role="presentation"
          onClick={() => setMemoryPayloadDialogOpen(false)}
        >
          <div
            className="memory-context-payload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${item.id}-memory-payload-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="memory-context-payload-dialog-header">
              <div>
                <h3 id={`${item.id}-memory-payload-title`}>
                  {t("messages.memoryContextSentDetailsTitle")}
                </h3>
                <p>{t("messages.memoryContextSentDetailsHint")}</p>
              </div>
              <button
                type="button"
                className="memory-context-payload-dialog-close"
                aria-label={t("messages.memoryContextCloseDetails")}
                onClick={() => setMemoryPayloadDialogOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="memory-context-payload-dialog-body">
              {memoryPayloadPacks.length > 0 ? (
                <div className="memory-context-payload-pack-list">
                  {memoryPayloadPacks.map((pack, packIndex) => (
                    <section
                      key={`${item.id}-memory-payload-pack-${packIndex}`}
                      className="memory-context-payload-pack"
                    >
                      <div className="memory-context-payload-pack-header">
                        <span className="memory-context-payload-pack-title">
                          {t("messages.memoryContextPayloadPackTitle", {
                            index: packIndex + 1,
                          })}
                        </span>
                        <span className="memory-context-payload-pack-meta">
                          {t("messages.memoryContextPayloadPackMeta", {
                            source: pack.source || t("messages.memoryContextSourceUnknown"),
                            count: Number(pack.count),
                          })}
                        </span>
                      </div>
                      <div className="memory-context-payload-section-label">
                        {t("messages.memoryContextPayloadCleanedContext")}
                      </div>
                      <Markdown
                        value={pack.cleanedContext}
                        className="markdown memory-context-payload-markdown"
                        workspaceId={workspaceId}
                        codeBlockStyle="message"
                        codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                        onOpenFileLink={onOpenFileLink}
                        onOpenFileLinkMenu={onOpenFileLinkMenu}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <Markdown
                  value={memorySummaryRawPayload}
                  className="markdown memory-context-payload-markdown"
                  workspaceId={workspaceId}
                  codeBlockStyle="message"
                  codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                  onOpenFileLink={onOpenFileLink}
                  onOpenFileLinkMenu={onOpenFileLinkMenu}
                />
              )}
              <details className="memory-context-payload-raw">
                <summary>{t("messages.memoryContextPayloadRaw")}</summary>
                <pre className="memory-context-payload-dialog-code">
                  <code>{memorySummaryRawPayload}</code>
                </pre>
              </details>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null;
  const memorySummaryNode = resolvedMemorySummary ? (
    <>
      <div className="memory-context-summary-card">
        <button
          type="button"
          className="memory-context-summary-toggle"
          onClick={() => setMemorySummaryExpanded((current) => !current)}
          aria-expanded={memorySummaryExpanded}
        >
          <span className="memory-context-summary-title">
            {t("messages.memoryContextSummary")}
          </span>
          <span className="memory-context-summary-count">
            {t("messages.memoryContextSummaryCount", {
              count: resolvedMemorySummary.lines.length,
            })}
          </span>
          {memorySummaryExpanded ? (
            <ChevronUp size={14} aria-hidden />
          ) : (
            <ChevronDown size={14} aria-hidden />
          )}
        </button>
        {memorySummaryExpanded && (
          <div className="memory-context-summary-content">
            {memorySummaryRecords.length > 0 ? (
              <div className="memory-context-summary-record-list">
                {memorySummaryRecords.map((record) => {
                  const sourceLabel = record.source === "manual-selection"
                    ? t("messages.memoryContextSourceManual")
                    : record.source === "memory-scout"
                      ? t("messages.memoryContextSourceMemoryReference")
                      : (record.source || t("messages.memoryContextSourceUnknown"));
                  return (
                    <div
                      key={`${item.id}-${record.displayIndex}-${record.index}-${record.memoryId}`}
                      className="memory-context-summary-record"
                    >
                      <span className="memory-context-summary-record-index">
                        {record.displayIndex}
                      </span>
                      <span className="memory-context-summary-record-copy">
                        <span className="memory-context-summary-record-title">
                          {record.title || record.memoryId}
                        </span>
                        <span className="memory-context-summary-record-meta">
                          {t("messages.memoryContextRecordMeta", {
                            source: sourceLabel,
                            index: record.index,
                          })}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Markdown
                value={resolvedMemorySummary.markdown ?? resolvedMemorySummary.lines.join("\n\n")}
                className="markdown memory-context-summary-markdown"
                workspaceId={workspaceId}
                codeBlockStyle="message"
                codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                onOpenFileLink={onOpenFileLink}
                onOpenFileLinkMenu={onOpenFileLinkMenu}
              />
            )}
            {memorySummaryRawPayload ? (
              <button
                type="button"
                className="memory-context-summary-detail-button"
                onClick={() => setMemoryPayloadDialogOpen(true)}
              >
                {t("messages.memoryContextViewSentDetails")}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {memoryPayloadDialogNode}
    </>
  ) : null;
  if (!memorySummaryNode && !noteCardSummaryNode && !browserContextSummaryNode && !intentCanvasContextSummaryNode && !codeAnnotationContextNode && !shouldRenderBubble) {
    return null;
  }
  const stackedContent = memorySummaryNode || noteCardSummaryNode || browserContextSummaryNode || intentCanvasContextSummaryNode || codeAnnotationContextNode ? (
    <div className={`message-context-stack${item.role === "user" ? " is-user" : ""}`}>
      {memorySummaryNode}
      {codeAnnotationContextNode}
      {browserContextSummaryNode}
      {intentCanvasContextSummaryNode}
      {noteCardSummaryNode}
      {shouldRenderBubble ? bubbleNode : null}
    </div>
  ) : bubbleNode;

  const agentBadgeNode = hasExternalAgentBadge ? (
    <div className={`message-user-agent-rail${isAgentBadgeExpanded ? " is-open" : ""}`}>
      <button
        type="button"
        className="message-agent-icon-button"
        onClick={handleToggleAgentBadge}
        aria-expanded={isAgentBadgeExpanded}
        aria-label={
          selectedAgentName
            ? t("messages.agentBadgeWithNameAriaLabel", { name: selectedAgentName })
            : t("messages.agentBadgeAriaLabel")
        }
        title={selectedAgentName ?? undefined}
      >
        <AgentIcon
          icon={selectedAgentIcon}
          seed={selectedAgentName ?? item.id}
          fallback="codicon-hubot"
          className="message-agent-icon-glyph"
          size={30}
        />
      </button>
      {isAgentBadgeExpanded && selectedAgentName && (
        <div className="message-agent-reveal is-visible" role="status">
          <span className="message-agent-tag-text">{selectedAgentName}</span>
        </div>
      )}
    </div>
  ) : null;

  const messageClassName = [
    "message",
    item.role,
    agentTaskNotification ? "message-agent-task" : "",
    item.role === "assistant" && isStreaming ? "is-live-streaming" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={messageClassName}>
      {hasExternalAgentBadge ? (
        <div className="message-user-layout">
          {agentBadgeNode}
          {stackedContent}
        </div>
      ) : stackedContent}
    </div>
  );
}, areMessageRowPropsEqual);

export const ReasoningRow = memo(function ReasoningRow({
  item,
  workspaceId = null,
  parsed,
  isExpanded,
  isLive,
  activeEngine,
  onToggle,
  onOpenFileLink,
  onOpenFileLinkMenu,
  presentationProfile = null,
  streamMitigationProfile = null,
}: ReasoningRowProps) {
  const { t } = useTranslation();
  const { bodyText } = parsed;
  const shouldPreferRawClaudeContent =
    activeEngine === "claude" &&
    item.summary.trim().length > 0 &&
    item.content.trim().length > 0 &&
    item.summary.trim() === item.content.trim() &&
    item.content.includes("\n");
  const thinkingText = shouldPreferRawClaudeContent
    ? item.content
    : bodyText || item.content || item.summary || "";
  // live reasoning delta 同样走 deferred：紧急渲染复用旧文本，重解析推后台。
  const deferredThinkingText = useDeferredValue(thinkingText);
  const renderThinkingText = isLive ? deferredThinkingText : thinkingText;
  const isEncryptedCodexReasoning =
    activeEngine === "codex" && thinkingText.trim() === "Encrypted reasoning";
  useRenderHotspot(
    "message-row-render",
    `reasoning:${thinkingText.length}ch:${isLive ? "stream" : "idle"}`,
    isLive && !isEncryptedCodexReasoning,
  );
  if (isEncryptedCodexReasoning) {
    return null;
  }
  const title = activeEngine === "claude"
    ? t("messages.thinkingLabel")
    : isLive
      ? t("messages.thinkingProcess")
      : t("messages.thinkingLabel");
  return (
    <div className={`thinking-block${isExpanded ? " is-expanded" : ""}${isLive ? " is-live" : ""}`}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => onToggle(item.id)}
      >
        <span className="thinking-header-copy">
          <span className="thinking-title">{title}</span>
        </span>
        <span
          className={`codicon thinking-icon ${isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
          aria-hidden
        />
      </button>
      <div
        className="thinking-content"
        style={{ display: isExpanded ? "block" : "none" }}
      >
        {thinkingText ? (
          <div className="reasoning-markdown-surface">
            {/*
              live 阶段走 lightweight markdown：reasoning delta 更新频繁，即使
              折叠（display: none）也会执行完整 react-markdown 重解析，是流式
              期间的隐藏 CPU 大头；settle 后切回 full markdown 渲染最终内容。
            */}
            <Markdown
              value={renderThinkingText}
              className={`markdown reasoning-markdown${isLive ? " markdown-live-streaming" : ""}`}
              workspaceId={workspaceId}
              codeBlockStyle="message"
              streamingThrottleMs={resolveReasoningStreamingThrottleMs(
                isLive,
                streamMitigationProfile,
                presentationProfile,
              )}
              liveRenderMode={isLive ? "lightweight" : "full"}
              onOpenFileLink={onOpenFileLink}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
            />
          </div>
        ) : (
          <span>{t("messages.noThinkingContent")}</span>
        )}
      </div>
    </div>
  );
});

export const GeneratedImageRow = memo(function GeneratedImageRow({
  item,
  workspaceId = null,
}: GeneratedImageRowProps) {
  const { t } = useTranslation();
  const generatedImageTitle = t("messages.generatedImageTitle");
  const generatedImageProcessingLabel = t("messages.generatedImageProcessing");
  const generatedImageCompletedLabel = t("messages.generatedImageCompleted");
  const generatedImageDegradedLabel = t("messages.generatedImageDegraded");
  const generatedImageProcessingHint = t("messages.generatedImageProcessingHint");
  const generatedImageDegradedHint = t("messages.generatedImageDegradedHint");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageItems = useMemo(
    () =>
      item.images.map((image, index) => ({
        src: image.src,
        label: t("messages.generatedImagePreviewLabel", {
          index: index + 1,
        }),
        localPath: image.localPath ?? null,
      })),
    [item.images, t],
  );
  const statusLabel =
    item.status === "processing"
      ? generatedImageProcessingLabel
      : item.status === "completed"
        ? generatedImageCompletedLabel
        : generatedImageDegradedLabel;
  const statusClassName =
    item.status === "processing"
      ? "is-processing"
      : item.status === "completed"
        ? "is-completed"
        : "is-degraded";

  return (
    <div
      className="message-generated-image-card"
      data-generated-image-anchor={item.anchorUserMessageId ?? undefined}
    >
      <div className="message-generated-image-header">
        <div className="message-generated-image-title-group">
          <span className="message-generated-image-eyebrow">
            {generatedImageTitle}
          </span>
          {item.promptText ? (
            <div className="message-generated-image-prompt">{item.promptText}</div>
          ) : null}
        </div>
        <span className={`message-generated-image-status ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
      {item.status === "processing" ? (
        <div className="message-generated-image-hint">
          {generatedImageProcessingHint}
        </div>
      ) : null}
      {imageItems.length > 0 ? (
        <div className="message-generated-image-grid" role="list">
          {imageItems.map((image, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              className="message-generated-image-thumb"
              onClick={() => setLightboxIndex(index)}
              aria-label={image.label}
            >
              <LocalImage
                src={image.src}
                localPath={image.localPath}
                workspaceId={workspaceId}
                alt={image.label}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
      {item.status === "degraded" ? (
        <div className="message-generated-image-hint">
          {item.fallbackText || generatedImageDegradedHint}
        </div>
      ) : null}
      {lightboxIndex !== null && imageItems.length > 0 ? (
        <ImageLightbox
          images={imageItems.map(({ src, label }) => ({ src, label }))}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}, (previous, next) => (
  previous.workspaceId === next.workspaceId
  && areGeneratedImageItemsEqual(previous.item, next.item)
));

export const ReviewRow = memo(function ReviewRow({
  item,
  workspaceId = null,
  onOpenFileLink,
  onOpenFileLinkMenu,
}: ReviewRowProps) {
  const title = item.state === "started" ? "Review started" : "Review completed";
  return (
    <div className="item-card review">
      <div className="review-header">
        <span className="review-title">{title}</span>
        <span
          className={`review-badge ${item.state === "started" ? "active" : "done"}`}
        >
          Review
        </span>
      </div>
      {item.text && (
        <Markdown
          value={item.text}
          className="item-text markdown"
          workspaceId={workspaceId}
          onOpenFileLink={onOpenFileLink}
          onOpenFileLinkMenu={onOpenFileLinkMenu}
        />
      )}
    </div>
  );
});

export const DiffRow = memo(function DiffRow({ item }: DiffRowProps) {
  return (
    <div className="item-card diff">
      <div className="diff-header">
        <span className="diff-title">{item.title}</span>
        {item.status && <span className="item-status">{item.status}</span>}
      </div>
      <div className="diff-viewer-output">
        <DiffBlock diff={item.diff} language={languageFromPath(item.title)} />
      </div>
    </div>
  );
});

function exploreKindLabel(kind: ExploreRowProps["item"]["entries"][number]["kind"]) {
  return (kind[0] ?? "").toUpperCase() + kind.slice(1);
}

function buildInlineExploreTitle(
  title: string,
  entry: ExploreRowProps["item"]["entries"][number] | undefined,
) {
  if (!entry) {
    return title;
  }
  const detail = entry.detail && entry.detail !== entry.label ? entry.detail : "";
  return [title, "·", exploreKindLabel(entry.kind), entry.label, detail]
    .filter(Boolean)
    .join(" ");
}

export const ExploreRow = memo(function ExploreRow({
  item,
  isExpanded,
  onToggle,
}: ExploreRowProps) {
  const { t } = useTranslation();
  const title = item.title ?? (item.status === "exploring" ? "Exploring" : "Explored");
  const isCollapsible =
    item.collapsible ?? (item.status === "explored" && item.entries.length > 0);
  const listCollapsed = isCollapsible && !isExpanded;
  const inlineSummary = listCollapsed;
  const rowClassName = `tool-inline explore-inline${isCollapsible ? " is-collapsible" : ""}${
    listCollapsed ? " is-collapsed" : ""
  }${inlineSummary ? " is-inline-summary" : ""}`;
  const displayTitle = inlineSummary
    ? buildInlineExploreTitle(title, item.entries[0])
    : title;
  const handleToggle = () => {
    if (!isCollapsible) {
      return;
    }
    onToggle(item.id);
  };
  return (
    <div className={rowClassName}>
      <div className="tool-inline-content">
        <div className="explore-inline-header">
          {isCollapsible ? (
            <button
              type="button"
              className="explore-inline-header-toggle"
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-label={`${displayTitle} · ${t("messages.toggleDetails")}`}
            >
              <Search className="explore-inline-icon" size={14} aria-hidden />
              <span className="explore-inline-title" title={displayTitle}>
                {displayTitle}
              </span>
            </button>
          ) : (
            <>
              <Search className="explore-inline-icon" size={14} aria-hidden />
              <span className="explore-inline-title" title={displayTitle}>
                {displayTitle}
              </span>
            </>
          )}
        </div>
        <div className={`explore-inline-list${listCollapsed ? " is-collapsed" : ""}`}>
          {item.entries.map((entry, index) => (
            <div key={`${entry.kind}-${entry.label}-${index}`} className="explore-inline-item">
              <span className="explore-inline-kind">{exploreKindLabel(entry.kind)}</span>
              <span className="explore-inline-label">{entry.label}</span>
              {entry.detail && entry.detail !== entry.label && (
                <span className="explore-inline-detail">{entry.detail}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
