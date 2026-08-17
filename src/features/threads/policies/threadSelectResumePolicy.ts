export const THREAD_SWITCH_LOADED_REFRESH_MS = 20_000;

export type ThreadSelectResumeDecision =
  | {
      action: "skip";
      reason:
        | "processing"
        | "empty-cooldown"
        | "loaded-fresh"
        | "failed"
        | "never-started";
    }
  | {
      action: "resume";
      reason: "unloaded" | "loaded-stale" | "empty-first";
      force: boolean;
    };

export type ThreadHistoryHintInput = {
  sizeBytes?: number | null;
  physicalPath?: string | null;
};

export function hasThreadHistoryHint(
  summary?: ThreadHistoryHintInput | null,
): boolean {
  if (!summary) {
    return false;
  }
  if (
    typeof summary.sizeBytes === "number" &&
    Number.isFinite(summary.sizeBytes) &&
    summary.sizeBytes > 0
  ) {
    return true;
  }
  return (
    typeof summary.physicalPath === "string" &&
    summary.physicalPath.trim().length > 0
  );
}

export function isKnownNeverStartedThread(input: {
  threadId: string;
  isLoaded: boolean;
  itemCount: number;
  summary?: ThreadHistoryHintInput | null;
}): boolean {
  const normalizedThreadId = input.threadId.trim().toLowerCase();
  if (normalizedThreadId.includes("-pending-")) {
    return true;
  }
  if (input.isLoaded || input.itemCount > 0) {
    return false;
  }
  if (!input.summary) {
    return false;
  }
  if (hasThreadHistoryHint(input.summary)) {
    return false;
  }
  return input.summary.sizeBytes === 0;
}

export function decideThreadSelectResume(input: {
  isLoaded: boolean;
  isProcessing: boolean;
  historyLoadingFailed: boolean;
  isEmptySurface: boolean;
  isNeverStarted: boolean;
  nowMs: number;
  lastRefreshAtMs: number;
  lastEmptySurfaceResumeAtMs: number;
  refreshIntervalMs?: number;
}): ThreadSelectResumeDecision {
  const refreshMs = input.refreshIntervalMs ?? THREAD_SWITCH_LOADED_REFRESH_MS;

  if (input.isProcessing) {
    return { action: "skip", reason: "processing" };
  }

  if (input.historyLoadingFailed) {
    return { action: "skip", reason: "failed" };
  }

  if (input.isNeverStarted) {
    return { action: "skip", reason: "never-started" };
  }

  if (input.isLoaded) {
    if (input.nowMs - input.lastRefreshAtMs >= refreshMs) {
      return { action: "resume", reason: "loaded-stale", force: false };
    }
    return { action: "skip", reason: "loaded-fresh" };
  }

  if (input.isEmptySurface) {
    if (
      input.lastEmptySurfaceResumeAtMs > 0 &&
      input.nowMs - input.lastEmptySurfaceResumeAtMs < refreshMs
    ) {
      return { action: "skip", reason: "empty-cooldown" };
    }
    return { action: "resume", reason: "empty-first", force: false };
  }

  return { action: "resume", reason: "unloaded", force: false };
}
