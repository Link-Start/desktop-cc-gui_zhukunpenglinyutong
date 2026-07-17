export const GIT_HISTORY_DATE_PRESETS = ["all", "today", "7d", "30d"] as const;

export type GitHistoryDatePreset = (typeof GIT_HISTORY_DATE_PRESETS)[number];

export type GitHistoryCommitFilterValues = {
  query: string;
  author: string;
  datePreset: GitHistoryDatePreset;
};

export type GitHistoryDateRange = {
  dateFrom: number | null;
  dateTo: number | null;
};

export function sanitizeGitHistoryDatePreset(value: unknown): GitHistoryDatePreset {
  return typeof value === "string"
    && GIT_HISTORY_DATE_PRESETS.includes(value as GitHistoryDatePreset)
    ? value as GitHistoryDatePreset
    : "all";
}

export function resolveGitHistoryDateRange(
  preset: GitHistoryDatePreset,
  nowMs = Date.now(),
): GitHistoryDateRange {
  if (preset === "all") {
    return { dateFrom: null, dateTo: null };
  }

  const dateTo = Math.floor(nowMs / 1_000);
  if (preset === "today") {
    const localMidnight = new Date(nowMs);
    localMidnight.setHours(0, 0, 0, 0);
    return {
      dateFrom: Math.floor(localMidnight.getTime() / 1_000),
      dateTo,
    };
  }

  const days = preset === "7d" ? 7 : 30;
  return {
    dateFrom: Math.floor((nowMs - days * 24 * 60 * 60 * 1_000) / 1_000),
    dateTo,
  };
}
