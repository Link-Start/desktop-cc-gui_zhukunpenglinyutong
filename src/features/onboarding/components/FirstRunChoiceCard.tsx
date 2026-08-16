import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FirstRunChoiceCardProps = {
  selected: boolean;
  title: string;
  hint?: string;
  compact?: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  titleAccessory?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
};

export function FirstRunChoiceCard({
  selected,
  title,
  hint,
  compact = false,
  onSelect,
  icon,
  titleAccessory,
  trailing,
  disabled = false,
}: FirstRunChoiceCardProps) {
  return (
    <div
      className={cn(
        "first-run-choice",
        selected && "is-selected",
        compact && "is-compact",
        disabled && "is-disabled",
      )}
    >
      <button
        type="button"
        className="first-run-choice-main"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
      >
        {icon ? <span className="first-run-choice-icon">{icon}</span> : null}
        <span className="first-run-choice-copy">
          <span className="first-run-choice-title-row">
            <span className="first-run-choice-title">{title}</span>
            {titleAccessory}
          </span>
          {hint ? <span className="first-run-choice-hint">{hint}</span> : null}
        </span>
      </button>
      {trailing ? (
        <span className="first-run-choice-trailing">{trailing}</span>
      ) : null}
    </div>
  );
}
