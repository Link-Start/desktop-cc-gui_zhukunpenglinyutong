import { memo, useMemo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import Brain from "lucide-react/dist/esm/icons/brain";
import type { ConversationItem } from "../../../../types";
import { CollapsibleReveal } from "../../../../components/common/CollapsibleReveal";
import { useRenderHotspot } from "../../../../services/perfBaseline/useRenderHotspot";
import type { PresentationProfile } from "../../../../conversation-presentation/presentationProfile";
import { parseReasoning } from "../../presentation/messagesReasoning";
import {
  resolveReasoningStreamingThrottleMs,
  type StreamMitigationProfile,
} from "../presentation/messagesStreamingComplexity";
import { Markdown } from "../../components/Markdown";
import {
  normalizeFragmentedLineBreaks,
  normalizeFragmentedParagraphBreaks,
} from "../../../../markdown/presentation/markdownTextNormalizers";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";
import {
  resolveResidualLiveItemDeltaText,
  useLiveItemDelta,
} from "../../../threads/hooks/useLiveItemDelta";
import { isLiveDeltaExternalizationEnabled } from "../../../threads/utils/realtimePerfFlags";

// A4 二期 live-delta 外部化：模块加载时读一次，翻转 flag 需刷新页面
//（与 MessageRow 的 LIVE_TEXT_EXTERNALIZATION_ENABLED 同语义）。
const LIVE_DELTA_EXTERNALIZATION_ENABLED = isLiveDeltaExternalizationEnabled();

type ReasoningRowProps = {
  item: Extract<ConversationItem, { kind: "reasoning" }>;
  workspaceId?: string | null;
  threadId?: string | null;
  parsed: ReturnType<typeof parseReasoning>;
  isExpanded: boolean;
  isLive: boolean;
  activeEngine?: MessagesEngine;
  onToggle: (id: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenHtmlInBrowser?: (path: string) => void;
  onOpenFileLinkMenu?: (event: MouseEvent, path: string) => void;
  presentationProfile?: PresentationProfile | null;
  streamMitigationProfile?: StreamMitigationProfile | null;
};

export const ReasoningRow = memo(function ReasoningRow({
  item,
  workspaceId = null,
  threadId = null,
  parsed,
  isExpanded,
  isLive,
  activeEngine,
  onToggle,
  onOpenFileLink,
  onOpenHtmlInBrowser,
  onOpenFileLinkMenu,
  presentationProfile = null,
  streamMitigationProfile = null,
}: ReasoningRowProps) {
  const { t } = useTranslation();
  // A4 二期：流式中的思考行订阅 liveItemDeltaChannel 两个 lane（通道自首条
  // delta 起全量累计，durable summary/content 仅为建壳首段），后续 delta 只
  // 驱动本行小树渲染。非 live 行/flag 关闭时订阅为空、零开销。
  // 若 settle 竞态导致 isLive 已关、通道仍有更长全文，residual 兜底避免界面
  // 只剩建壳首段（对齐 MessageRow 正文 residual 模式）。
  const liveReasoningContent = useLiveItemDelta(
    threadId,
    item.id,
    "reasoningContent",
    LIVE_DELTA_EXTERNALIZATION_ENABLED && isLive,
  );
  const liveReasoningSummary = useLiveItemDelta(
    threadId,
    item.id,
    "reasoningSummary",
    LIVE_DELTA_EXTERNALIZATION_ENABLED && isLive,
  );
  const residualReasoningContent =
    LIVE_DELTA_EXTERNALIZATION_ENABLED && !isLive && threadId
      ? resolveResidualLiveItemDeltaText(
          threadId,
          item.id,
          "reasoningContent",
          item.content,
        )
      : null;
  const residualReasoningSummary =
    LIVE_DELTA_EXTERNALIZATION_ENABLED && !isLive && threadId
      ? resolveResidualLiveItemDeltaText(
          threadId,
          item.id,
          "reasoningSummary",
          item.summary,
        )
      : null;
  const effectiveContent =
    liveReasoningContent ?? residualReasoningContent ?? item.content;
  const effectiveSummary =
    liveReasoningSummary ?? residualReasoningSummary ?? item.summary;
  const hasLiveOverride =
    effectiveContent !== item.content || effectiveSummary !== item.summary;
  // 有 live 覆盖时按覆盖后的全文重新 parse（保持 title 剥离/去重语义一致）；
  // 无覆盖时直接用父级按 durable item 算好的 parsed，零额外成本。
  const effectiveParsed = useMemo(
    () =>
      hasLiveOverride
        ? parseReasoning({
            ...item,
            content: effectiveContent,
            summary: effectiveSummary,
          })
        : parsed,
    [hasLiveOverride, item, effectiveContent, effectiveSummary, parsed],
  );
  const { bodyText } = effectiveParsed;
  // header 固定显示「思考过程 / 思考中」，不会渲染 summaryTitle。
  // 当 summary 与 content 同为多行正文时，parseReasoning 会把首行当 title 剥掉，
  // 导致合并后的相邻思考丢失第一段；此时直接用 raw content。
  const shouldPreferRawReasoningContent =
    effectiveSummary.trim().length > 0 &&
    effectiveContent.trim().length > 0 &&
    effectiveSummary.trim() === effectiveContent.trim() &&
    effectiveContent.includes("\n");
  const thinkingText = shouldPreferRawReasoningContent
    ? effectiveContent
    : bodyText || effectiveContent || effectiveSummary || "";
  // live lightweight 会跳过 Markdown 的 fragment normalize；A4 首 token 沙拉
  // 必须在进渲染前拼回，否则孤立 `，` / 半截英文会各自占一段。
  const renderThinkingText = useMemo(
    () =>
      thinkingText
        ? normalizeFragmentedLineBreaks(
            normalizeFragmentedParagraphBreaks(thinkingText.replace(/\r\n/g, "\n")),
          )
        : thinkingText,
    [thinkingText],
  );
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
  const title = isLive ? t("messages.thinking") : t("messages.thinkingProcess");
  return (
    <div className={`thinking-block${isExpanded ? " is-expanded" : ""}${isLive ? " is-live" : ""}`}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => onToggle(item.id)}
      >
        <span className="thinking-header-copy">
          <Brain className="thinking-brain-icon" size={14} aria-hidden />
          <span className="thinking-title">{title}</span>
        </span>
      </button>
      {/*
        始终 keepMounted：对齐旧 display:none 语义（折叠仍保留 Markdown DOM，
        避免 live delta / 合并正文 / 测试与搜索锚点丢失），仅用动画开合。
      */}
      <CollapsibleReveal
        open={isExpanded}
        keepMounted
        className="thinking-content-reveal"
        innerClassName="thinking-content"
      >
        {thinkingText ? (
          <div className="reasoning-markdown-surface">
            {/*
              live 阶段走 lightweight markdown：reasoning delta 更新频繁；
              settle 后切回 full markdown 渲染最终内容。
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
              onOpenHtmlInBrowser={onOpenHtmlInBrowser}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
            />
          </div>
        ) : (
          <span>{t("messages.noThinkingContent")}</span>
        )}
      </CollapsibleReveal>
    </div>
  );
});
