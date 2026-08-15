/**
 * startup-gate-ready 归因：仅 first-paint / home-input / force-enter 可 stamp。
 * full-catalog settle MUST NOT 调用 stampStartupGateReady。
 */

import { getStartupTraceSnapshot, recordStartupMilestone } from "./startupTrace";

export type StartupGateReadyReason =
  | "first-paint-complete"
  | "home-input-ready"
  | "force-enter";

export type StartupGateReadyListener = (
  reason: StartupGateReadyReason | null,
) => void;

let gateReadyReason: StartupGateReadyReason | null = null;
const gateReadyListeners = new Set<StartupGateReadyListener>();

export function getStartupGateReadyReason(): StartupGateReadyReason | null {
  return gateReadyReason;
}

/**
 * The gate opens once per app run. Subscribers fire exactly once on stamp;
 * a late subscriber (mounted after the gate already opened) fires immediately.
 */
export function subscribeStartupGateReady(
  listener: StartupGateReadyListener,
): () => void {
  if (getStartupTraceSnapshot().milestones["startup-gate-ready"]) {
    try {
      listener(gateReadyReason);
    } catch {
      // ignore listener failures
    }
    return () => {};
  }
  gateReadyListeners.add(listener);
  return () => {
    gateReadyListeners.delete(listener);
  };
}

/**
 * Stamp gate-ready once with an allowed reason.
 * Returns true if this call recorded the milestone.
 */
export function stampStartupGateReady(reason: StartupGateReadyReason): boolean {
  if (getStartupTraceSnapshot().milestones["startup-gate-ready"]) {
    if (!gateReadyReason) {
      gateReadyReason = reason;
    }
    return false;
  }
  gateReadyReason = reason;
  recordStartupMilestone("startup-gate-ready");
  gateReadyListeners.forEach((listener) => {
    try {
      listener(reason);
    } catch {
      // ignore listener failures
    }
  });
  gateReadyListeners.clear();
  return true;
}

/** @internal */
export function resetStartupGateReadyForTests(): void {
  gateReadyReason = null;
  gateReadyListeners.clear();
}
