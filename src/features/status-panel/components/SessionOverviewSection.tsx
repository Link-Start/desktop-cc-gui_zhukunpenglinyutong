import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDurationCompact,
  formatTokenCount,
} from "../../messages/utils/messagesRenderUtils";
import type { SessionOverviewViewModel } from "../utils/sessionOverviewViewModel";

type SessionOverviewSectionProps = {
  overview: SessionOverviewViewModel;
  compact?: boolean;
};

export const SessionOverviewSection = memo(function SessionOverviewSection({
  overview,
  compact = false,
}: SessionOverviewSectionProps) {
  const { t } = useTranslation();
  const sectionClass = `sp-checkpoint-section sp-session-overview${compact ? " is-compact" : ""}`;

  if (!overview.hasAnyContent) {
    return (
      <section className={sectionClass}>
        <div className="sp-checkpoint-inline-heading">
          <span className="sp-checkpoint-section-title">
            {t("statusPanel.sessionOverview.title")}
          </span>
          <span className="sp-checkpoint-action-hint">
            {t("statusPanel.sessionOverview.empty")}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <div className="sp-checkpoint-inline-heading">
        <span className="sp-checkpoint-section-title">
          {t("statusPanel.sessionOverview.title")}
        </span>
        <span
          className={`sp-session-overview-status is-${overview.status}`}
        >
          {t(`statusPanel.sessionOverview.status.${overview.status}`)}
        </span>
      </div>
      <div className="sp-checkpoint-evidence-summary-badges">
        {overview.engine ? (
          <span className="sp-checkpoint-evidence-badge">
            {overview.engine}
            {overview.model ? ` · ${overview.model}` : ""}
          </span>
        ) : null}
        {overview.workspaceLabel ? (
          <span className="sp-checkpoint-evidence-badge">
            {overview.workspaceLabel}
          </span>
        ) : null}
        {overview.durationMs != null ? (
          <span className="sp-checkpoint-evidence-badge">
            {overview.status === "idle"
              ? t("statusPanel.sessionOverview.duration.last", {
                  duration: formatDurationCompact(overview.durationMs),
                })
              : t("statusPanel.sessionOverview.duration.running", {
                  duration: formatDurationCompact(overview.durationMs),
                })}
          </span>
        ) : null}
        {overview.messageCount > 0 ? (
          <span className="sp-checkpoint-evidence-badge">
            {t("statusPanel.sessionOverview.turns", {
              turns: overview.turnCount,
              messages: overview.messageCount,
            })}
          </span>
        ) : null}
        {overview.contextUsedPercent != null ? (
          <span className="sp-checkpoint-evidence-badge">
            {t("statusPanel.sessionOverview.context", {
              percent: overview.contextUsedPercent,
            })}
            {overview.contextUsedTokens != null &&
            overview.modelContextWindow != null
              ? ` (${formatTokenCount(overview.contextUsedTokens)}/${formatTokenCount(overview.modelContextWindow)})`
              : ""}
          </span>
        ) : null}
        {overview.rateLimitPrimaryPercent != null ? (
          <span className="sp-checkpoint-evidence-badge">
            {t("statusPanel.sessionOverview.rateLimit", {
              percent: overview.rateLimitPrimaryPercent,
            })}
          </span>
        ) : null}
        {overview.pendingApprovals > 0 ? (
          <span className="sp-checkpoint-evidence-badge is-attention">
            {t("statusPanel.sessionOverview.pendingApprovals", {
              count: overview.pendingApprovals,
            })}
          </span>
        ) : null}
        {overview.pendingUserInputs > 0 ? (
          <span className="sp-checkpoint-evidence-badge is-attention">
            {t("statusPanel.sessionOverview.pendingUserInputs", {
              count: overview.pendingUserInputs,
            })}
          </span>
        ) : null}
      </div>
    </section>
  );
});
