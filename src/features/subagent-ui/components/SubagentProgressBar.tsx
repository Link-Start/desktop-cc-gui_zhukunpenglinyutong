import { memo } from "react";
import { cn } from "@/lib/utils";
import type { SubagentCardStatus } from "../utils/subagentViewModel";

type SubagentProgressBarProps = {
  progress: number;
  status: SubagentCardStatus;
  className?: string;
};

export const SubagentProgressBar = memo(function SubagentProgressBar({
  progress,
  status,
  className,
}: SubagentProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      className={cn("subagent-progress", `is-${status}`, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className={cn(
          "subagent-progress-fill",
          status === "running" && clamped < 1 && "is-indeterminate-hint",
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
});
