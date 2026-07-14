import { type ComponentProps } from "react";

import { FloatingTooltipButton } from "./floating-tooltip-button";

type TooltipIconButtonProps = Omit<
  ComponentProps<typeof FloatingTooltipButton>,
  "tooltipLabel" | "tooltipDelay"
> & {
  label: string;
  delay?: number;
};

export function TooltipIconButton({ label, delay, ...props }: TooltipIconButtonProps) {
  return (
    <FloatingTooltipButton
      tooltipLabel={label}
      tooltipDelay={delay}
      aria-label={props["aria-label"] ?? label}
      {...props}
    />
  );
}
