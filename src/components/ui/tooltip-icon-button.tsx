import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
} from "@floating-ui/react-dom";
import { cn } from "../../lib/utils";
import { TOOLTIP_POPUP_CLASS_NAME } from "./tooltip";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipAlign = "start" | "center" | "end";

function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

type TooltipIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  tooltipSide?: TooltipSide;
  tooltipAlign?: TooltipAlign;
  tooltipSideOffset?: number;
  tooltipClassName?: string;
  delay?: number;
};

export function TooltipIconButton({
  label,
  children,
  tooltipSide = "bottom",
  tooltipAlign = "center",
  tooltipSideOffset = 6,
  tooltipClassName,
  delay = 200,
  type = "button",
  title,
  "aria-label": ariaLabel,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
  onPointerCancel,
  onPointerDown,
  disabled,
  ...buttonProps
}: TooltipIconButtonProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const placement = useMemo<Placement>(
    () =>
      tooltipAlign === "center"
        ? tooltipSide
        : `${tooltipSide}-${tooltipAlign}`,
    [tooltipAlign, tooltipSide],
  );
  const middleware = useMemo(
    () => [offset(tooltipSideOffset), flip(), shift({ padding: 8 })],
    [tooltipSideOffset],
  );
  const { refs, floatingStyles, placement: resolvedPlacement } = useFloating({
    open,
    placement,
    strategy: "fixed",
    middleware,
    whileElementsMounted: autoUpdate,
  });
  // Opening synchronously on mouseenter turns every pointer crossing into a
  // portal mount + forced reflow. Honor `delay` so only a dwell opens it.
  const openTimerRef = useRef<number | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, delay);
  }, [clearOpenTimer, delay]);

  const closeNow = useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer]);

  useEffect(() => clearOpenTimer, [clearOpenTimer]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeTooltip = () => {
      setOpen(false);
    };
    const closeWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        closeTooltip();
      }
    };

    window.addEventListener("blur", closeTooltip);
    document.addEventListener("visibilitychange", closeWhenHidden);

    return () => {
      window.removeEventListener("blur", closeTooltip);
      document.removeEventListener("visibilitychange", closeWhenHidden);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      closeNow();
    }
  }, [disabled, closeNow]);

  return (
    <>
      <button
        ref={refs.setReference}
        type={type}
        title={title}
        aria-label={ariaLabel ?? label}
        aria-describedby={open ? tooltipId : undefined}
        disabled={disabled}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          if (!disabled) {
            scheduleOpen();
          }
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          closeNow();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          // Only keyboard focus opens immediately (a11y). Pointer clicks also
          // fire focus right after pointerdown; opening there would mount a
          // tooltip portal on every click.
          if (!disabled && isKeyboardFocus(event.currentTarget)) {
            clearOpenTimer();
            setOpen(true);
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          closeNow();
        }}
        onClick={(event) => {
          onClick?.(event);
          closeNow();
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          closeNow();
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          closeNow();
        }}
        {...buttonProps}
      >
        {children}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={refs.setFloating}
              id={tooltipId}
              role="tooltip"
              data-slot="tooltip-popup"
              data-side={resolvedPlacement.split("-")[0]}
              className={cn(TOOLTIP_POPUP_CLASS_NAME, tooltipClassName)}
              style={floatingStyles}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
