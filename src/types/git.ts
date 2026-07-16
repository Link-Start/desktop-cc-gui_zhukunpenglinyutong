export type GitFileStatus = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  isDiffOnlyFallback?: boolean;
  mutationDisabled?: boolean;
};

export type GitFileDiff = {
  path: string;
  status?: string;
  diff: string;
  isBinary?: boolean;
  isImage?: boolean;
  isDiffOnlyFallback?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

export type GitCommitDiff = {
  path: string;
  status: string;
  diff: string;
  isBinary?: boolean;
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

export type GitLogEntry = {
  sha: string;
  summary: string;
  author: string;
  timestamp: number;
};

export type BridgePayloadBudgetMetadata = {
  command: string;
  surfaceId: string;
  itemCount: number;
  estimatedBytes: number;
  partial: boolean;
  truncated: boolean;
  cacheState: "hit" | "miss" | "invalidated" | "unsupported";
  evidenceClass: "measured" | "proxy" | "unsupported" | string;
};

export type GitLogResponse = {
  total: number;
  entries: GitLogEntry[];
  ahead: number;
  behind: number;
  aheadEntries: GitLogEntry[];
  behindEntries: GitLogEntry[];
  upstream: string | null;
  payloadBudget?: BridgePayloadBudgetMetadata | null;
};

export type GitHistoryCommit = {
  sha: string;
  shortSha: string;
  summary: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: number;
  parents: string[];
  refs: string[];
};

export type GitHistoryResponse = {
  snapshotId: string;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  commits: GitHistoryCommit[];
};

export type GitPushPreviewResponse = {
  sourceBranch: string;
  targetRemote: string;
  targetBranch: string;
  targetRef: string;
  targetFound: boolean;
  hasMore: boolean;
  commits: GitHistoryCommit[];
};

export type GitBranchCompareCommitSets = {
  targetOnlyCommits: GitHistoryCommit[];
  currentOnlyCommits: GitHistoryCommit[];
};

export type GitPrWorkflowDefaults = {
  upstreamRepo: string;
  baseBranch: string;
  headOwner: string;
  headBranch: string;
  title: string;
  body: string;
  commentBody: string;
  canCreate: boolean;
  disabledReason?: string | null;
};

export type GitPrWorkflowStageStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type GitPrWorkflowStage = {
  key: string;
  status: GitPrWorkflowStageStatus | string;
  detail: string;
  command?: string | null;
  stdout?: string | null;
  stderr?: string | null;
};

export type GitPrExistingPullRequest = {
  number: number;
  title: string;
  url: string;
  state: string;
  headRefName: string;
  baseRefName: string;
};

export type GitPrWorkflowResult = {
  ok: boolean;
  status: "success" | "failed" | "existing";
  message: string;
  errorCategory?: string | null;
  nextActionHint?: string | null;
  prUrl?: string | null;
  prNumber?: number | null;
  existingPr?: GitPrExistingPullRequest | null;
  retryCommand?: string | null;
  stages: GitPrWorkflowStage[];
};

export type GitCommitFileChange = {
  path: string;
  oldPath?: string | null;
  status: string;
  additions: number;
  deletions: number;
  isBinary?: boolean;
  isImage?: boolean;
  diff: string;
  lineCount: number;
  truncated: boolean;
};

export type GitCommitDetails = {
  sha: string;
  summary: string;
  message: string;
  author: string;
  authorEmail: string;
  committer: string;
  committerEmail: string;
  authorTime: number;
  commitTime: number;
  parents: string[];
  files: GitCommitFileChange[];
  totalAdditions: number;
  totalDeletions: number;
};

export type GitBranchListItem = {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  remote?: string | null;
  upstream?: string | null;
  lastCommit: number;
  headSha?: string | null;
  ahead: number;
  behind: number;
};

export type GitBranchListResponse = {
  branches: BranchInfo[];
  localBranches?: GitBranchListItem[];
  remoteBranches?: GitBranchListItem[];
  currentBranch?: string | null;
  repositoryState?: GitBranchListRepositoryState;
  diagnostic?: GitBranchListDiagnostic | null;
};

export type GitRepositoryHeadState =
  | "branch"
  | "detached"
  | "unborn"
  | "unavailable";

export type GitRepositoryFileStatus = {
  path: string;
  status: "A" | "M" | "D" | "R" | "T" | "U";
};

export type GitRepositorySummary = {
  repositoryRoot: string;
  displayName: string;
  currentBranch: string | null;
  headState: GitRepositoryHeadState;
  upstream: string | null;
  ahead: number;
  behind: number;
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  fileStatuses: GitRepositoryFileStatus[];
  isClean: boolean;
  error: string | null;
};

export type GitBranchListRepositoryState =
  | "git_repository"
  | "not_git_repository"
  | "unknown";

export type GitBranchListDiagnostic = {
  kind: string;
  reason?: string | null;
  message?: string | null;
  workspaceId?: string | null;
  pathKind?: string | null;
};

export type GitBranchUpdateStatus = "success" | "no-op" | "blocked";

export type GitBranchUpdateReason =
  | "already_up_to_date"
  | "ahead_only"
  | "no_upstream"
  | "diverged"
  | "occupied_worktree"
  | "stale_ref";

export type GitBranchUpdateResult = {
  branch: string;
  status: GitBranchUpdateStatus;
  reason?: GitBranchUpdateReason | null;
  message: string;
  worktreePath?: string | null;
};

export type GitHubIssue = {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
};

export type GitHubIssuesResponse = {
  total: number;
  issues: GitHubIssue[];
};

export type GitHubUser = {
  login: string;
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  body: string;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  author: GitHubUser | null;
};

export type GitHubPullRequestsResponse = {
  total: number;
  pullRequests: GitHubPullRequest[];
};

export type GitHubPullRequestDiff = {
  path: string;
  status: string;
  diff: string;
};

export type GitHubPullRequestComment = {
  id: number;
  body: string;
  createdAt: string;
  url: string;
  author: GitHubUser | null;
};

export type BranchInfo = {
  name: string;
  lastCommit: number;
};
