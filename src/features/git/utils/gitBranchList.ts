import type {
  BranchInfo,
  GitBranchListItem,
  GitBranchListDiagnostic,
  GitBranchListRepositoryState,
} from "../../../types";

export type NormalizedGitBranchList = {
  branches: BranchInfo[];
  localBranches: GitBranchListItem[];
  remoteBranches: GitBranchListItem[];
  currentBranch: string | null;
  repositoryState: GitBranchListRepositoryState;
  diagnostic: GitBranchListDiagnostic | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBranchInfo(value: unknown): BranchInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = String(value.name ?? "").trim();
  if (!name) {
    return null;
  }
  return {
    name,
    lastCommit: Number(value.lastCommit ?? value.last_commit ?? 0),
  };
}

function normalizeBranchListItem(value: unknown): GitBranchListItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = String(value.name ?? "").trim();
  if (!name) {
    return null;
  }
  const remote = typeof value.remote === "string" ? value.remote.trim() || null : null;
  const upstream =
    typeof value.upstream === "string" ? value.upstream.trim() || null : null;
  const headSha =
    typeof value.headSha === "string"
      ? value.headSha.trim() || null
      : typeof value.head_sha === "string"
        ? value.head_sha.trim() || null
        : null;
  return {
    name,
    isCurrent: Boolean(value.isCurrent ?? value.is_current),
    isRemote: Boolean(value.isRemote ?? value.is_remote),
    remote,
    upstream,
    lastCommit: Number(value.lastCommit ?? value.last_commit ?? 0),
    headSha,
    ahead: Number(value.ahead ?? 0),
    behind: Number(value.behind ?? 0),
  };
}

function normalizeBranchListItems(value: unknown): GitBranchListItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const normalized = normalizeBranchListItem(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeRepositoryState(value: unknown): GitBranchListRepositoryState {
  return value === "git_repository" ||
    value === "not_git_repository" ||
    value === "unknown"
    ? value
    : "git_repository";
}

function normalizeDiagnostic(value: unknown): GitBranchListDiagnostic | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = String(value.kind ?? "").trim();
  if (!kind) {
    return null;
  }
  return {
    kind,
    reason: typeof value.reason === "string" ? value.reason : null,
    message: typeof value.message === "string" ? value.message : null,
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : null,
    pathKind: typeof value.pathKind === "string" ? value.pathKind : null,
  };
}

export function normalizeGitBranchListResponse(response: unknown): NormalizedGitBranchList {
  const legacyResult =
    isRecord(response) && isRecord(response.result) ? response.result : undefined;
  const branchSource =
    isRecord(response) && Array.isArray(response.branches)
      ? response.branches
      : legacyResult && Array.isArray(legacyResult.branches)
        ? legacyResult.branches
        : Array.isArray(response)
          ? response
          : [];
  const repositoryState = isRecord(response)
    ? normalizeRepositoryState(response.repositoryState)
    : "git_repository";
  const diagnostic = isRecord(response)
    ? normalizeDiagnostic(response.diagnostic)
    : null;
  const currentBranch =
    isRecord(response) && typeof response.currentBranch === "string"
      ? response.currentBranch.trim() || null
      : null;
  const localBranches = isRecord(response)
    ? normalizeBranchListItems(response.localBranches ?? response.local_branches)
    : [];
  const remoteBranches = isRecord(response)
    ? normalizeBranchListItems(response.remoteBranches ?? response.remote_branches)
    : [];
  const branches = branchSource.flatMap((item) => {
    const normalized = normalizeBranchInfo(item);
    return normalized ? [normalized] : [];
  });
  const effectiveLocalBranches =
    localBranches.length > 0
      ? localBranches
      : branches.map((branch) => ({
          ...branch,
          isCurrent: branch.name === currentBranch,
          isRemote: false,
          remote: null,
          upstream: null,
          headSha: null,
          ahead: 0,
          behind: 0,
        }));

  return {
    branches,
    localBranches: effectiveLocalBranches,
    remoteBranches,
    currentBranch,
    repositoryState,
    diagnostic,
  };
}
