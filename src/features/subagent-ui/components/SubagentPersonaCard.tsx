import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SubagentCardViewModel } from "../utils/subagentViewModel";
import { openSubagentInspector } from "../hooks/useSubagentInspectorStore";
import { PersonaAvatar } from "./PersonaAvatar";
import { SubagentProgressBar } from "./SubagentProgressBar";

type SubagentPersonaCardProps = {
  card: SubagentCardViewModel;
  selected?: boolean;
  /** compact：矮卡片；row：状态面板单行列表 */
  compact?: boolean;
  layout?: "card" | "row";
  className?: string;
  onSelect?: (card: SubagentCardViewModel) => void;
};

export const SubagentPersonaCard = memo(function SubagentPersonaCard({
  card,
  selected = false,
  compact = false,
  layout = "card",
  className,
  onSelect,
}: SubagentPersonaCardProps) {
  const { t } = useTranslation();
  const statusLabel =
    card.status === "completed"
      ? t("subagentUi.status.completed", { defaultValue: "已完成" })
      : card.status === "error"
        ? t("subagentUi.status.error", { defaultValue: "失败" })
        : t("subagentUi.status.running", { defaultValue: "运行中" });

  const isRow = layout === "row";

  const badgeLabel = t("subagentUi.badge", { defaultValue: "SubAgent" });

  return (
    <button
      type="button"
      className={cn(
        "subagent-persona-card",
        `is-${card.status}`,
        selected && "is-selected",
        compact && "is-compact",
        isRow && "is-row",
        className,
      )}
      onClick={() => {
        if (onSelect) {
          onSelect(card);
          return;
        }
        openSubagentInspector(card);
      }}
      aria-pressed={selected}
      title={card.description}
    >
      <div className="subagent-persona-card-head">
        <PersonaAvatar
          displayName={card.displayName}
          avatarSrc={card.avatarSrc}
          githubProfileUrl={card.githubProfileUrl}
          size={isRow ? 26 : compact ? 22 : 26}
        />
        <div className="subagent-persona-identity">
          <span className="subagent-persona-name">{card.displayName}</span>
          <span className="subagent-persona-index">{card.indexLabel}</span>
        </div>
        {!isRow ? (
          <span className="subagent-persona-badge" aria-hidden>
            {badgeLabel}
          </span>
        ) : (
          <span className={cn("subagent-persona-status", `is-${card.status}`)}>
            {statusLabel}
          </span>
        )}
      </div>
      {!isRow ? (
        <p className="subagent-persona-desc" title={card.description}>
          {card.description}
        </p>
      ) : (
        <p className="subagent-persona-desc is-inline" title={card.description}>
          {card.description}
        </p>
      )}
      {!isRow ? (
        <div className="subagent-persona-meta">
          {card.toolCount != null ? (
            <span className="subagent-persona-tools">
              {t("subagentUi.toolCount", {
                count: card.toolCount,
                defaultValue: "{{count}} 个工具",
              })}
            </span>
          ) : (
            <span className="subagent-persona-type">{card.typeLabel}</span>
          )}
          <span className={cn("subagent-persona-status", `is-${card.status}`)}>
            {statusLabel}
          </span>
        </div>
      ) : null}
      <SubagentProgressBar progress={card.progress} status={card.status} />
    </button>
  );
});
