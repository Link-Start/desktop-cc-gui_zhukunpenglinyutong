import type {
  GitRepositoryFileStatus,
  GitRepositoryHeadState,
  GitRepositorySummary,
} from "../../../types";

const GIT_REPOSITORY_FILE_STATUSES = new Set<GitRepositoryFileStatus["status"]>([
  "A", "M", "D", "R", "T", "U",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.floor(numericValue)
    : 0;
}

function normalizeHeadState(value: unknown): GitRepositoryHeadState {
  return value === "branch" ||
    value === "detached" ||
    value === "unborn" ||
    value === "unavailable"
    ? value
    : "unavailable";
}

function normalizeRepositoryRelativePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replaceAll("\\", "/").replace(/\/+/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized.split("/");
  return segments.some((segment) => !segment || segment === "." || segment === "..")
    ? null
    : normalized;
}

function normalizeGitRepositoryFileStatuses(value: unknown): GitRepositoryFileStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const path = normalizeRepositoryRelativePath(entry.path);
    const status = String(entry.status ?? "").trim().toUpperCase() as GitRepositoryFileStatus["status"];
    return path && GIT_REPOSITORY_FILE_STATUSES.has(status) ? [{ path, status }] : [];
  });
}

export function normalizeGitRepositorySummary(
  value: unknown,
): GitRepositorySummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const repositoryRoot = String(value.repositoryRoot ?? value.repository_root ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  const displayName = String(value.displayName ?? value.display_name ?? "").trim();
  if (!displayName) {
    return null;
  }
  const optionalText = (candidate: unknown) =>
    typeof candidate === "string" ? candidate.trim() || null : null;
  return {
    repositoryRoot,
    displayName,
    currentBranch: optionalText(value.currentBranch ?? value.current_branch),
    headState: normalizeHeadState(value.headState ?? value.head_state),
    upstream: optionalText(value.upstream),
    ahead: nonNegativeInteger(value.ahead),
    behind: nonNegativeInteger(value.behind),
    stagedCount: nonNegativeInteger(value.stagedCount ?? value.staged_count),
    modifiedCount: nonNegativeInteger(value.modifiedCount ?? value.modified_count),
    untrackedCount: nonNegativeInteger(value.untrackedCount ?? value.untracked_count),
    conflictedCount: nonNegativeInteger(value.conflictedCount ?? value.conflicted_count),
    fileStatuses: normalizeGitRepositoryFileStatuses(value.fileStatuses ?? value.file_statuses),
    isClean: value.isClean === true || value.is_clean === true,
    error: optionalText(value.error),
  };
}

export function projectGitRepositoryFileStatuses(
  repositories: readonly GitRepositorySummary[],
): GitRepositoryFileStatus[] {
  return repositories.flatMap((repository) => repository.fileStatuses.flatMap((entry) => {
    const repositoryRoot = normalizeRepositoryRelativePath(repository.repositoryRoot);
    if (repository.repositoryRoot !== "" && !repositoryRoot) return [];
    return [{
      path: repositoryRoot ? `${repositoryRoot}/${entry.path}` : entry.path,
      status: entry.status,
    }];
  }));
}

export function normalizeGitRepositorySummaries(value: unknown): GitRepositorySummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const summaries = value.flatMap((item) => {
    const summary = normalizeGitRepositorySummary(item);
    return summary ? [summary] : [];
  });
  return summaries.sort((left, right) => {
    if (left.repositoryRoot === "") {
      return -1;
    }
    if (right.repositoryRoot === "") {
      return 1;
    }
    return left.repositoryRoot.localeCompare(right.repositoryRoot);
  });
}

export function areGitRepositorySummariesEqual(
  left: readonly GitRepositorySummary[],
  right: readonly GitRepositorySummary[],
): boolean {
  return left.length === right.length && left.every((summary, index) => {
    const other = right[index];
    return other !== undefined && Object.keys(summary).every((key) => {
      const summaryKey = key as keyof GitRepositorySummary;
      if (summaryKey === "fileStatuses") {
        return summary.fileStatuses.length === other.fileStatuses.length &&
          summary.fileStatuses.every((entry, fileIndex) => {
            const otherEntry = other.fileStatuses[fileIndex];
            return entry.path === otherEntry?.path && entry.status === otherEntry.status;
          });
      }
      return summary[summaryKey] === other[summaryKey];
    });
  });
}

export function gitRepositoryBranchLabel(repository: GitRepositorySummary): string {
  if (repository.error) {
    return "!";
  }
  if (repository.headState === "detached") {
    return "HEAD";
  }
  if (repository.headState === "unborn") {
    return "NEW";
  }
  return repository.currentBranch ?? "—";
}

export function gitRepositoryStatusTokens(repository: GitRepositorySummary): string[] {
  const tokens = [gitRepositoryBranchLabel(repository)];
  if (repository.ahead > 0) tokens.push(`↑${repository.ahead}`);
  if (repository.behind > 0) tokens.push(`↓${repository.behind}`);
  if (repository.stagedCount > 0) tokens.push(`A${repository.stagedCount}`);
  if (repository.modifiedCount > 0) tokens.push(`M${repository.modifiedCount}`);
  if (repository.untrackedCount > 0) tokens.push(`?${repository.untrackedCount}`);
  if (repository.conflictedCount > 0) tokens.push(`!${repository.conflictedCount}`);
  if (repository.isClean) tokens.push("✓");
  return tokens;
}

export type GitRepositoryStatusItemKind =
  | "branch"
  | "sync"
  | "clean"
  | "dirty"
  | "conflict"
  | "error";

export type GitRepositoryStatusItem = {
  label: string;
  kind: GitRepositoryStatusItemKind;
};

export function gitRepositoryStatusItems(
  repository: GitRepositorySummary,
): GitRepositoryStatusItem[] {
  const tokens = gitRepositoryStatusTokens(repository);
  return tokens.map((label, index) => {
    if (repository.error && index === 0) return { label, kind: "error" };
    if (index === 0) return { label, kind: "branch" };
    if (label === "✓") return { label, kind: "clean" };
    if (label.startsWith("↑") || label.startsWith("↓")) return { label, kind: "sync" };
    if (label.startsWith("!")) return { label, kind: "conflict" };
    return { label, kind: "dirty" };
  });
}
