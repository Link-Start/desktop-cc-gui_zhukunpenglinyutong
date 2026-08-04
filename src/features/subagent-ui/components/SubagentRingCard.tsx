import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SubagentCardViewModel } from "../utils/subagentViewModel";
import { openSubagentInspector } from "../hooks/useSubagentInspectorStore";

type SubagentRingCardProps = {
  card: SubagentCardViewModel;
  selected?: boolean;
  className?: string;
  onSelect?: (card: SubagentCardViewModel) => void;
};

/** 环进度 0..100；终态 completed/error 固定满环，running 用 progress。 */
export function resolveRingPercent(card: SubagentCardViewModel): number {
  if (card.status === "completed" || card.status === "error") {
    return 100;
  }
  const raw = Number.isFinite(card.progress) ? card.progress : 0;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export function resolveRingTitle(card: SubagentCardViewModel, fallback: string): string {
  const description = card.description?.trim();
  if (description) {
    return description;
  }
  const typeLabel = card.typeLabel?.trim();
  if (typeLabel) {
    return typeLabel;
  }
  return fallback;
}

export const SubagentRingCard = memo(function SubagentRingCard({
  card,
  selected = false,
  className,
  onSelect,
}: SubagentRingCardProps) {
  const { t } = useTranslation();
  const badgeFallback = t("subagentUi.badge", { defaultValue: "SubAgent" });
  const title = resolveRingTitle(card, badgeFallback);
  const percent = resolveRingPercent(card);
  const isError = card.status === "error";
  const statusLabel =
    card.status === "completed"
      ? t("subagentUi.status.completed", { defaultValue: "已完成" })
      : card.status === "error"
        ? t("subagentUi.status.error", { defaultValue: "失败" })
        : t("subagentUi.status.running", { defaultValue: "运行中" });

  const ringStyle = useMemo(() => {
    const fill =
      card.status === "completed"
        ? "var(--subagent-ring-ok, #34d399)"
        : card.status === "error"
          ? "var(--subagent-ring-err, #f87171)"
          : "var(--subagent-ring-run, #60a5fa)";
    const track = "color-mix(in srgb, var(--border, #3c4048) 55%, transparent)";
    return {
      background: `conic-gradient(${fill} ${percent}%, ${track} 0)`,
    } as const;
  }, [card.status, percent]);

  // 失败态环心用 !；完成/运行显示百分比（完成恒为 100）
  const ringCenter = isError ? "!" : String(percent);
  const tooltipParts = [title, card.typeLabel?.trim(), statusLabel].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );

  return (
    <button
      type="button"
      className={cn(
        "subagent-ring-card",
        `is-${card.status}`,
        selected && "is-selected",
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
      title={tooltipParts.join(" · ")}
      aria-label={
        isError
          ? `${title}, ${statusLabel}`
          : `${title}, ${statusLabel}, ${percent}%`
      }
    >
      <span className="subagent-ring" style={ringStyle} aria-hidden>
        <span className="subagent-ring-center">{ringCenter}</span>
      </span>
      <span className="subagent-ring-title">{title}</span>
    </button>
  );
});
