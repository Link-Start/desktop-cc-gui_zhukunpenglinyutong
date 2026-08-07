import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getStartupTraceSnapshot,
  subscribeStartupTrace,
} from "../../startup-orchestration/utils/startupTrace";
import { isWindowsPlatform } from "../../../utils/platform";

/** After this delay, show the force-dismiss control (user: 5s). */
export const WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS = 5_000;

/**
 * Auto-unmask only after this much wall time AND a late-enough ready signal.
 * first-paint / early input-ready alone must NOT unmask (field: mask closes →
 * click still freezes while full-catalog / other IPC runs).
 */
export const WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS = 8_000;

/** Absolute ceiling: auto-unmask even without milestone. */
export const WINDOWS_STARTUP_GATE_MAX_VISIBLE_MS = 20_000;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Ready for auto-unmask (must still wait MIN_VISIBLE_MS).
 * - `startup-gate-ready`: full-catalog finished (preferred)
 * - home-only: `input-ready` without ever starting active workspace list
 */
function isLateEnoughReady(): boolean {
  const milestones = getStartupTraceSnapshot().milestones;
  if (milestones["startup-gate-ready"]) {
    return true;
  }
  // Home / no list path: input-ready without workspace list ever starting.
  if (
    milestones["input-ready"] &&
    !milestones["active-workspace-ready"]
  ) {
    return true;
  }
  return false;
}

/**
 * Windows-only full-window mask during cold start so users cannot click into
 * the busy hydrate window.
 *
 * Close rules:
 * - Auto: late ready (`startup-gate-ready` / home input) AND min 8s visible
 * - Auto ceiling: 20s
 * - Force: button after 5s
 */
export function WindowsStartupGateOverlay() {
  const { t } = useTranslation();
  const [enabled] = useState(() => isWindowsPlatform());
  const mountedAtRef = useRef(nowMs());
  const [open, setOpen] = useState(() => enabled);
  const [showForceDismiss, setShowForceDismiss] = useState(false);

  useEffect(() => {
    if (!enabled || !open) {
      return;
    }

    const tryAutoClose = () => {
      const elapsed = nowMs() - mountedAtRef.current;
      if (elapsed >= WINDOWS_STARTUP_GATE_MAX_VISIBLE_MS) {
        setOpen(false);
        return;
      }
      if (isLateEnoughReady() && elapsed >= WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS) {
        setOpen(false);
      }
    };

    tryAutoClose();

    const unsub = subscribeStartupTrace(tryAutoClose);
    const forceTimer = window.setTimeout(() => {
      setShowForceDismiss(true);
    }, WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS);
    const tickTimer = window.setInterval(tryAutoClose, 250);

    return () => {
      unsub();
      window.clearTimeout(forceTimer);
      window.clearInterval(tickTimer);
    };
  }, [enabled, open]);

  if (!enabled || !open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex flex-col items-center justify-center gap-4 bg-[color-mix(in_srgb,var(--surface-messages,#0d0f14)_92%,transparent)] text-foreground backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={t("runtimeNotice.windowsStartupGate.title")}
      data-testid="windows-startup-gate-overlay"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="size-9 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        aria-hidden
      />
      <p className="max-w-sm px-6 text-center text-sm text-muted-foreground">
        {t("runtimeNotice.windowsStartupGate.message")}
      </p>
      {showForceDismiss ? (
        <button
          type="button"
          className="mt-2 rounded-md border border-border bg-background/80 px-4 py-2 text-sm text-foreground shadow-sm hover:bg-background"
          data-testid="windows-startup-gate-force-dismiss"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
        >
          {t("runtimeNotice.windowsStartupGate.forceDismiss")}
        </button>
      ) : null}
    </div>
  );
}
