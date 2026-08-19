/**
 * Canvas history restore progress for Shared (and reusable by other loaders).
 * percent is 0–100; UI may show determinate bar when present.
 */
export type HistoryLoadingPhaseId =
  | "prepare"
  | "session"
  | "projection"
  | "merge"
  | "finalize";

export type HistoryLoadingProgress = {
  phase: HistoryLoadingPhaseId;
  percent: number;
  /** i18n key under messages.* */
  titleKey: string;
  /** i18n key under messages.* */
  detailKey: string;
  detailParams?: Record<string, string | number>;
};

export type HistoryLoadingProgressListener = (
  progress: HistoryLoadingProgress,
) => void;

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

export function buildSharedHistoryPrepareProgress(): HistoryLoadingProgress {
  return {
    phase: "prepare",
    percent: 8,
    titleKey: "restoringSharedHistory",
    detailKey: "restoringSharedHistoryPrepare",
  };
}

export function buildSharedHistorySessionProgress(
  step: "start" | "done",
  itemCount?: number,
): HistoryLoadingProgress {
  if (step === "start") {
    return {
      phase: "session",
      percent: 22,
      titleKey: "restoringSharedHistory",
      detailKey: "restoringSharedHistorySession",
    };
  }
  return {
    phase: "session",
    percent: 48,
    titleKey: "restoringSharedHistory",
    detailKey: "restoringSharedHistorySessionDone",
    detailParams: {
      count: typeof itemCount === "number" ? itemCount : 0,
    },
  };
}

export function buildSharedHistoryProjectionProgress(
  step: "start" | "skip" | "done",
  itemCount?: number,
): HistoryLoadingProgress {
  if (step === "start") {
    return {
      phase: "projection",
      percent: 58,
      titleKey: "restoringSharedHistory",
      detailKey: "restoringSharedHistoryProjection",
    };
  }
  if (step === "skip") {
    return {
      phase: "projection",
      percent: 72,
      titleKey: "restoringSharedHistory",
      detailKey: "restoringSharedHistoryProjectionSkip",
    };
  }
  return {
    phase: "projection",
    percent: 82,
    titleKey: "restoringSharedHistory",
    detailKey: "restoringSharedHistoryProjectionDone",
    detailParams: {
      count: typeof itemCount === "number" ? itemCount : 0,
    },
  };
}

export function buildSharedHistoryMergeProgress(
  step: "start" | "done",
  totalItems?: number,
): HistoryLoadingProgress {
  if (step === "start") {
    return {
      phase: "merge",
      percent: 90,
      titleKey: "restoringSharedHistory",
      detailKey: "restoringSharedHistoryMerge",
    };
  }
  return {
    phase: "merge",
    percent: 96,
    titleKey: "restoringSharedHistory",
    detailKey: "restoringSharedHistoryMergeDone",
    detailParams: {
      count: typeof totalItems === "number" ? totalItems : 0,
    },
  };
}

export function buildSharedHistoryFinalizeProgress(): HistoryLoadingProgress {
  return {
    phase: "finalize",
    percent: 100,
    titleKey: "restoringSharedHistory",
    detailKey: "restoringSharedHistoryFinalize",
  };
}

export function normalizeHistoryLoadingProgress(
  progress: HistoryLoadingProgress,
): HistoryLoadingProgress {
  return {
    ...progress,
    percent: clampPercent(progress.percent),
  };
}

export function sameHistoryLoadingProgress(
  left: HistoryLoadingProgress | undefined,
  right: HistoryLoadingProgress,
): boolean {
  if (!left) {
    return false;
  }
  return (
    left.phase === right.phase &&
    left.percent === right.percent &&
    left.titleKey === right.titleKey &&
    left.detailKey === right.detailKey &&
    sameHistoryLoadingDetailParams(left.detailParams, right.detailParams)
  );
}

function sameHistoryLoadingDetailParams(
  left?: Record<string, string | number>,
  right?: Record<string, string | number>,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

export function isSharedHistoryLoadingProgress(
  progress: HistoryLoadingProgress | null | undefined,
): boolean {
  return progress?.titleKey === "restoringSharedHistory";
}

export function buildNativeHistoryPrepareProgress(): HistoryLoadingProgress {
  return {
    phase: "prepare",
    percent: 8,
    titleKey: "restoringHistory",
    detailKey: "restoringHistoryPrepare",
  };
}

export function buildNativeHistorySessionWaitingProgress(): HistoryLoadingProgress {
  return {
    phase: "session",
    percent: 12,
    titleKey: "restoringHistory",
    detailKey: "restoringHistorySession",
  };
}

export function buildNativeHistoryParseProgress(
  itemCount?: number,
): HistoryLoadingProgress {
  return {
    phase: "projection",
    percent: 72,
    titleKey: "restoringHistory",
    detailKey: "restoringHistoryParse",
    detailParams: {
      count: typeof itemCount === "number" ? itemCount : 0,
    },
  };
}

export function buildNativeHistoryHydrateProgress(
  step: "start" | "done",
  itemCount?: number,
): HistoryLoadingProgress {
  return {
    phase: "merge",
    percent: step === "start" ? 86 : 96,
    titleKey: "restoringHistory",
    detailKey: "restoringHistoryHydrate",
    detailParams: {
      count: typeof itemCount === "number" ? itemCount : 0,
    },
  };
}

export function buildNativeHistoryFinalizeProgress(): HistoryLoadingProgress {
  return {
    phase: "finalize",
    percent: 100,
    titleKey: "restoringHistory",
    detailKey: "restoringHistoryFinalize",
  };
}

export const DSH_HISTORY_LOAD_MAX_PAGES = 40;

export type DshHistoryLoadProgressEvent = {
  sessionId: string;
  pageIndex: number;
  maxPages: number;
  pageEventCount: number;
  totalEventCount: number;
  hasMore: boolean;
};

export function mapDshHistoryLoadProgressEvent(
  event: DshHistoryLoadProgressEvent,
): HistoryLoadingProgress {
  const maxPages = Math.max(1, event.maxPages || DSH_HISTORY_LOAD_MAX_PAGES);
  const pageIndex = Math.max(0, event.pageIndex);
  const percent =
    pageIndex <= 0
      ? 12
      : clampPercent(12 + Math.floor((Math.min(pageIndex, maxPages) / maxPages) * 50));
  if (pageIndex <= 0) {
    return buildNativeHistorySessionWaitingProgress();
  }
  return {
    phase: "session",
    percent,
    titleKey: "restoringHistory",
    detailKey: "restoringHistorySessionPage",
    detailParams: {
      page: pageIndex,
      maxPages,
      pageEvents: Math.max(0, event.pageEventCount),
      totalEvents: Math.max(0, event.totalEventCount),
    },
  };
}

export function matchesDshHistoryLoadSession(
  eventSessionId: string,
  threadId: string,
  hostSessionId: string,
): boolean {
  return (
    eventSessionId === hostSessionId ||
    eventSessionId === threadId ||
    eventSessionId === `dsh:${hostSessionId}`
  );
}

export async function yieldHistoryLoadingPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
