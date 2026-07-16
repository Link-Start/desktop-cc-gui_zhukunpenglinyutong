export type GitRepositoryActionId =
  | "commit"
  | "stage-all"
  | "add-to-gitignore"
  | "show-diff"
  | "compare-revision"
  | "compare-branch"
  | "show-history"
  | "rollback"
  | "push"
  | "pull"
  | "fetch"
  | "merge"
  | "rebase"
  | "branches"
  | "create-tag"
  | "reset-head"
  | "stash"
  | "manage-remotes"
  | "clone";

export type GitRepositoryActionRequest = {
  action: GitRepositoryActionId;
  repositoryRoot: string;
};

export type GitRepositoryActionIntent = GitRepositoryActionRequest & {
  requestId: number;
};

type GitRepositoryActionListener = (intent: GitRepositoryActionIntent) => void;

export const GIT_REPOSITORY_ACTION_LABEL_KEYS: Record<
  GitRepositoryActionId,
  string
> = {
  commit: "git.repositoryMenuCommit",
  "stage-all": "git.repositoryMenuStageAll",
  "add-to-gitignore": "git.repositoryMenuAddToGitignore",
  "show-diff": "git.repositoryMenuShowDiff",
  "compare-revision": "git.repositoryMenuCompareRevision",
  "compare-branch": "git.repositoryMenuCompareBranch",
  "show-history": "git.repositoryMenuHistory",
  rollback: "git.repositoryMenuRollback",
  push: "git.repositoryMenuPush",
  pull: "git.repositoryMenuPull",
  fetch: "git.repositoryMenuFetch",
  merge: "git.repositoryMenuMerge",
  rebase: "git.repositoryMenuRebase",
  branches: "git.repositoryMenuBranches",
  "create-tag": "git.repositoryMenuCreateTag",
  "reset-head": "git.repositoryMenuResetHead",
  stash: "git.repositoryMenuStash",
  "manage-remotes": "git.repositoryMenuManageRemotes",
  clone: "git.repositoryMenuClone",
};

let nextRequestId = 0;
let pendingIntent: GitRepositoryActionIntent | null = null;
const listeners = new Set<GitRepositoryActionListener>();

export function publishGitRepositoryActionIntent(
  request: GitRepositoryActionRequest,
) {
  const intent = { ...request, requestId: ++nextRequestId };
  if (listeners.size === 0) {
    pendingIntent = intent;
    return;
  }
  listeners.forEach((listener) => listener(intent));
}

export function subscribeGitRepositoryActionIntent(
  listener: GitRepositoryActionListener,
) {
  listeners.add(listener);
  if (pendingIntent) {
    const intent = pendingIntent;
    pendingIntent = null;
    listener(intent);
  }
  return () => listeners.delete(listener);
}
