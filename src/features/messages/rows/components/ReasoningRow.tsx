import { memo, useDeferredValue, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import Brain from "lucide-react/dist/esm/icons/brain";
import type { ConversationItem } from "../../../../types";
import { useRenderHotspot } from "../../../../services/perfBaseline/useRenderHotspot";
import type { PresentationProfile } from "../../../../conversation-presentation/presentationProfile";
import { parseReasoning } from "../../presentation/messagesReasoning";
import {
  resolveReasoningStreamingThrottleMs,
  type StreamMitigationProfile,
} from "../presentation/messagesStreamingComplexity";
import { Markdown } from "../../components/Markdown";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";

type ReasoningRowProps = {
  item: Extract<ConversationItem, { kind: "reasoning" }>;
  workspaceId?: string | null;
  parsed: ReturnType<typeof parseReasoning>;
  isExpanded: boolean;
  isLive: boolean;
  activeEngine?: MessagesEngine;
  onToggle: (id: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: MouseEvent, path: string) => void;
  presentationProfile?: PresentationProfile | null;
  streamMitigationProfile?: StreamMitigationProfile | null;
};

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
  // header 固定显示「思考过程 / 思考中」，不会渲染 summaryTitle。
  // 当 summary 与 content 同为多行正文时，parseReasoning 会把首行当 title 剥掉，
  // 导致合并后的相邻思考丢失第一段；此时直接用 raw content。
  const shouldPreferRawReasoningContent =
    item.summary.trim().length > 0 &&
    item.content.trim().length > 0 &&
    item.summary.trim() === item.content.trim() &&
    item.content.includes("\n");
  const thinkingText = shouldPreferRawReasoningContent
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
