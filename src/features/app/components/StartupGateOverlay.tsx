import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getStartupTraceSnapshot,
  subscribeStartupTrace,
} from "../../startup-orchestration/utils/startupTrace";
import { startupOrchestrator } from "../../startup-orchestration/utils/startupOrchestrator";
import { markStartupForceEnter } from "../../startup-orchestration/utils/startupForceEnter";
import { isStartupGatePlatform } from "../../../utils/platform";

/**
 * Force-enter / max-visible unmask:
 * soft-cancel startup scans so late setThreads no-ops when the user clicks in.
 * Do NOT stamp startup-gate-ready here — that would immediately apply any
 * uiScale ≠ 1 (0.8 / 0.9 / 1.1 / 1.2 / …) into the same click window.
 * uiScale phase-2 waits for gate-ready, force-enter+delay, or 12s ceiling.
 */
function forceEnterApp(setOpen: (open: boolean) => void) {
  // Pending idle full-catalog re-schedules (post first-paint).
  markStartupForceEnter();
  // Must use "stale": thread-list fallback maps stale/cancelled → discard apply.
  startupOrchestrator.cancelAllTasks("stale");
  setOpen(false);
}

/** After this delay, show the force-dismiss control. */
export const STARTUP_GATE_FORCE_DISMISS_MS = 10_000;

/**
 * Auto-unmask only after this much wall time AND a late-enough ready signal.
 * first-paint / early input-ready alone must NOT unmask.
 */
export const STARTUP_GATE_MIN_VISIBLE_MS = 8_000;

/** Absolute ceiling: auto-unmask even without milestone. */
export const STARTUP_GATE_MAX_VISIBLE_MS = 20_000;

/** @deprecated Prefer STARTUP_GATE_FORCE_DISMISS_MS */
export const WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS = STARTUP_GATE_FORCE_DISMISS_MS;
/** @deprecated Prefer STARTUP_GATE_MIN_VISIBLE_MS */
export const WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS = STARTUP_GATE_MIN_VISIBLE_MS;
/** @deprecated Prefer STARTUP_GATE_MAX_VISIBLE_MS */
export const WINDOWS_STARTUP_GATE_MAX_VISIBLE_MS = STARTUP_GATE_MAX_VISIBLE_MS;

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
  if (
    milestones["input-ready"] &&
    !milestones["active-workspace-ready"]
  ) {
    return true;
  }
  return false;
}

/**
 * Desktop (Tauri: Windows / macOS / Linux) full-window mask during cold start so
 * users cannot click into the busy hydrate window.
 *
 * Close rules:
 * - Auto: late ready (`startup-gate-ready` / home input) AND min 8s visible
 * - Auto ceiling: 20s (+ force-enter cancel)
 * - Force: button after 10s (+ force-enter cancel)
 */
export function StartupGateOverlay() {
  const { t } = useTranslation();
  const [enabled] = useState(() => isStartupGatePlatform());
  const mountedAtRef = useRef(nowMs());
  const [open, setOpen] = useState(() => enabled);
  const [showForceDismiss, setShowForceDismiss] = useState(false);

  useEffect(() => {
    if (!enabled || !open) {
      return;
    }

    const tryAutoClose = () => {
      const elapsed = nowMs() - mountedAtRef.current;
      if (elapsed >= STARTUP_GATE_MAX_VISIBLE_MS) {
        forceEnterApp(setOpen);
        return;
      }
      if (isLateEnoughReady() && elapsed >= STARTUP_GATE_MIN_VISIBLE_MS) {
        setOpen(false);
      }
    };

    tryAutoClose();

    const unsub = subscribeStartupTrace(tryAutoClose);
    const forceTimer = window.setTimeout(() => {
      setShowForceDismiss(true);
    }, STARTUP_GATE_FORCE_DISMISS_MS);
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
      aria-label={t("runtimeNotice.startupGate.title")}
      data-testid="startup-gate-overlay"
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
        {t("runtimeNotice.startupGate.message")}
      </p>
      {showForceDismiss ? (
        <button
          type="button"
          className="mt-2 rounded-md border border-border bg-background/80 px-4 py-2 text-sm text-foreground shadow-sm hover:bg-background"
          data-testid="startup-gate-force-dismiss"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            forceEnterApp(setOpen);
          }}
        >
          {t("runtimeNotice.startupGate.forceDismiss")}
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer StartupGateOverlay */
export const WindowsStartupGateOverlay = StartupGateOverlay;
