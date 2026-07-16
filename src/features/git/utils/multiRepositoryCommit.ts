import {
  runScopedCommitOperation,
  type CommitScopeStatusSnapshot,
} from "./commitScope";

export type MultiRepositoryCommitInput = {
  repositoryRoot: string;
  displayName: string;
  gitStatus: CommitScopeStatusSnapshot;
  selectedPaths: string[];
};

export type MultiRepositoryCommitOutcome = {
  repositoryRoot: string;
  displayName: string;
  committed: boolean;
  pushed: boolean;
  commitError: string | null;
  pushError: string | null;
  postCommitError: string | null;
};

type MultiRepositoryCommitOptions = {
  workspaceId: string;
  commitMessage: string;
  repositories: MultiRepositoryCommitInput[];
  pushAfterCommit?: boolean;
  stageFile: (workspaceId: string, path: string, repositoryRoot: string) => Promise<unknown>;
  unstageFile: (workspaceId: string, path: string, repositoryRoot: string) => Promise<unknown>;
  commit: (workspaceId: string, message: string, repositoryRoot: string) => Promise<unknown>;
  push: (workspaceId: string, repositoryRoot: string) => Promise<unknown>;
  formatRestoreSelectionFailed?: (errorMessage: string) => string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runMultiRepositoryCommitOperations({
  workspaceId,
  commitMessage,
  repositories,
  pushAfterCommit = false,
  stageFile,
  unstageFile,
  commit,
  push,
  formatRestoreSelectionFailed,
}: MultiRepositoryCommitOptions): Promise<MultiRepositoryCommitOutcome[]> {
  const outcomes: MultiRepositoryCommitOutcome[] = [];
  for (const repository of repositories) {
    const outcome: MultiRepositoryCommitOutcome = {
      repositoryRoot: repository.repositoryRoot,
      displayName: repository.displayName,
      committed: false,
      pushed: false,
      commitError: null,
      pushError: null,
      postCommitError: null,
    };
    try {
      const result = await runScopedCommitOperation({
        workspaceId,
        gitStatus: repository.gitStatus,
        selectedPaths: repository.selectedPaths,
        commitMessage,
        stageFile: (id, path) => stageFile(id, path, repository.repositoryRoot),
        unstageFile: (id, path) => unstageFile(id, path, repository.repositoryRoot),
        commit: (id, message) => commit(id, message, repository.repositoryRoot),
        formatRestoreSelectionFailed,
      });
      outcome.committed = result.committed;
      outcome.postCommitError = result.postCommitError;
    } catch (error) {
      outcome.commitError = errorMessage(error);
    }
    if (pushAfterCommit && outcome.committed && !outcome.postCommitError) {
      try {
        await push(workspaceId, repository.repositoryRoot);
        outcome.pushed = true;
      } catch (error) {
        outcome.pushError = errorMessage(error);
      }
    }
    outcomes.push(outcome);
  }
  return outcomes;
}
