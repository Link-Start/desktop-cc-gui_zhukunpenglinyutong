import type { GitBranchUpdateResult } from "../../../types";

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function getGitBranchUpdateFeedback(
  t: Translate,
  result: GitBranchUpdateResult,
  fallbackBranch: string,
) {
  const params = {
    branch: result.branch || fallbackBranch,
    path: result.worktreePath ?? "",
  };
  const message = result.status === "blocked"
    ? result.reason === "diverged"
      ? t("git.historyBranchUpdateBlockedDiverged", params)
      : result.reason === "occupied_worktree"
        ? t("git.historyBranchUpdateBlockedOccupiedWorktree", params)
        : result.reason === "stale_ref"
          ? t("git.historyBranchUpdateBlockedStaleRef", params)
          : t("git.historyBranchUpdateBlockedNoUpstream", params)
    : result.status === "no-op"
      ? result.reason === "ahead_only"
        ? t("git.historyBranchUpdateAheadOnly", params)
        : t("git.historyBranchUpdateAlreadyUpToDate", params)
      : t("git.historyBranchUpdateSuccess", params);

  return {
    tone: result.status === "blocked" ? "error" as const : "success" as const,
    message,
  };
}
