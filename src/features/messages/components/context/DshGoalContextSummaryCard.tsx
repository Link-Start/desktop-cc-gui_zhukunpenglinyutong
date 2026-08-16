import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import type { ConversationPresentationContext } from "../../../../types";

type DshGoalContext = Extract<ConversationPresentationContext, { kind: "dsh-goal" }>;

const COLLAPSED_BODY_PREVIEW_MAX_CHARS = 96;

function buildGoalBodyPreview(body: string) {
  const normalized = body.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > COLLAPSED_BODY_PREVIEW_MAX_CHARS
    ? `${normalized.slice(0, COLLAPSED_BODY_PREVIEW_MAX_CHARS).trimEnd()}...`
    : normalized;
}

export const DshGoalContextSummaryCard = memo(function DshGoalContextSummaryCard({
  context,
}: {
  context: DshGoalContext;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const title = t("messages.dshGoalContextInjection");
  const sourceLabel = context.sourceLabel.trim() || "goal";
  const bodyPreview = buildGoalBodyPreview(context.body);

  useEffect(() => {
    setIsExpanded(false);
  }, [context.body, sourceLabel]);

  return (
    <div className="note-card-context-summary-card dsh-goal-context-summary-card">
      <div className="note-card-context-summary-head">
        <div className="note-card-context-summary-head-copy">
          <span className="note-card-context-summary-title">{title}</span>
          <span className="note-card-context-summary-count">{sourceLabel}</span>
        </div>
        <button
          type="button"
          className="note-card-context-summary-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? t("messages.dshGoalContextCollapse")
              : t("messages.dshGoalContextExpand")
          }
          title={
            isExpanded
              ? t("messages.dshGoalContextCollapse")
              : t("messages.dshGoalContextExpand")
          }
        >
          <span className="note-card-context-summary-toggle-label">
            {isExpanded
              ? t("messages.dshGoalContextCollapse")
              : t("messages.dshGoalContextExpand")}
          </span>
          <span className="note-card-context-summary-toggle-icon" aria-hidden>
            {isExpanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </span>
        </button>
      </div>
      {isExpanded ? (
        context.body.trim() ? (
          <pre className="dsh-goal-context-summary-body">{context.body}</pre>
        ) : null
      ) : bodyPreview ? (
        <p className="note-card-context-summary-preview">{bodyPreview}</p>
      ) : null}
    </div>
  );
});
