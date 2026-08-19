import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { CollapsibleReveal } from "../../../../components/common/CollapsibleReveal";
import type { ConversationPresentationContext } from "../../../../types";

type DshGoalContext = Extract<ConversationPresentationContext, { kind: "dsh-goal" }>;

const COMPLETED_STATUS_PILL = "completed";

export const DshGoalContextSummaryCard = memo(function DshGoalContextSummaryCard({
  context,
}: {
  context: DshGoalContext;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const title = t("messages.dshGoalContextInjection");
  const sourceLabel = context.sourceLabel.trim() || "goal";
  const collapsedLabel = `${title} · ${sourceLabel}`;
  const body = context.body.trim();

  useEffect(() => {
    setIsExpanded(false);
  }, [context.body, sourceLabel]);

  const ariaLabel = `${collapsedLabel}. ${
    isExpanded
      ? t("messages.dshGoalContextCollapse")
      : t("messages.dshGoalContextExpand")
  }`;

  return (
    <div
      className={`dsh-goal-context-summary-card message-agent-task-fold-drawer${
        isExpanded ? " is-expanded" : " is-collapsed"
      }`}
      data-testid="dsh-goal-context-fold"
    >
      <button
        type="button"
        className={`messages-process-phase-toggle${
          isExpanded ? " is-expanded" : " is-collapsed"
        }`}
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        aria-label={ariaLabel}
      >
        <span className="messages-process-phase-toggle-copy">
          <span className="message-agent-task-fold-status is-completed">
            {COMPLETED_STATUS_PILL}
          </span>
          <span className="message-agent-task-fold-label">{collapsedLabel}</span>
          <ChevronRight
            className="messages-process-phase-toggle-chevron"
            size={14}
            strokeWidth={2}
            aria-hidden
          />
        </span>
        <span className="messages-process-phase-toggle-rule" aria-hidden />
      </button>
      <CollapsibleReveal open={isExpanded}>
        {body ? (
          <div className="message-agent-task-fold-detail">
            <pre className="dsh-goal-context-summary-body">{context.body}</pre>
          </div>
        ) : null}
      </CollapsibleReveal>
    </div>
  );
});
