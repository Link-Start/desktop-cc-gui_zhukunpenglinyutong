export const PUSH_TARGET_HISTORY_LIMIT = 3;
export const PUSH_TARGET_HISTORY_STORE = "layout" as const;

export type GitPushTargetHistoryEntry = {
  remote: string;
  branch: string;
  pushToGerrit: boolean;
  topic: string;
  reviewers: string;
  cc: string;
  pushTags: boolean;
  runHooks: boolean;
  forceWithLease: boolean;
};

export function getPushTargetHistoryStorageKey(workspaceId: string): string {
  return `gitPushTargetHistory:${workspaceId}`;
}

export function getPushTargetHistoryIdentity(
  entry: Pick<GitPushTargetHistoryEntry, "remote" | "branch" | "pushToGerrit">,
): string {
  return `${entry.remote}\0${entry.branch}\0${entry.pushToGerrit ? "1" : "0"}`;
}

function readHistoryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readHistoryBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parsePushTargetHistory(
  value: unknown,
): GitPushTargetHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed: GitPushTargetHistoryEntry[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Partial<GitPushTargetHistoryEntry>;
    const remote = record.remote?.trim() ?? "";
    const branch = record.branch?.trim() ?? "";
    if (!remote || !branch) {
      continue;
    }
    const entry: GitPushTargetHistoryEntry = {
      remote,
      branch,
      pushToGerrit: readHistoryBoolean(record.pushToGerrit, false),
      topic: readHistoryString(record.topic),
      reviewers: readHistoryString(record.reviewers),
      cc: readHistoryString(record.cc),
      pushTags: readHistoryBoolean(record.pushTags, false),
      runHooks: readHistoryBoolean(record.runHooks, true),
      forceWithLease: readHistoryBoolean(record.forceWithLease, false),
    };
    const identity = getPushTargetHistoryIdentity(entry);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    parsed.push(entry);
    if (parsed.length >= PUSH_TARGET_HISTORY_LIMIT) {
      break;
    }
  }
  return parsed;
}

export function rememberPushTargetHistory(
  history: readonly GitPushTargetHistoryEntry[],
  nextEntry: GitPushTargetHistoryEntry,
): GitPushTargetHistoryEntry[] {
  const nextIdentity = getPushTargetHistoryIdentity(nextEntry);
  return [
    nextEntry,
    ...history.filter(
      (entry) => getPushTargetHistoryIdentity(entry) !== nextIdentity,
    ),
  ].slice(0, PUSH_TARGET_HISTORY_LIMIT);
}

export function isPushTargetHistoryMatch(
  entry: Pick<GitPushTargetHistoryEntry, "remote" | "branch" | "pushToGerrit">,
  current: Pick<GitPushTargetHistoryEntry, "remote" | "branch" | "pushToGerrit">,
): boolean {
  return getPushTargetHistoryIdentity(entry) === getPushTargetHistoryIdentity(current);
}
