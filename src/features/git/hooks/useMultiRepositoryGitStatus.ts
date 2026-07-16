import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGitStatus } from "../../../services/tauri";
import type { GitFileStatus, GitRepositorySummary, WorkspaceInfo } from "../../../types";

export type RepositoryGitStatus = {
  repositoryRoot: string;
  displayName: string;
  branchName: string;
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
  error: string | null;
};

function hasRepositoryChanges(repository: GitRepositorySummary) {
  return !repository.isClean ||
    repository.stagedCount > 0 ||
    repository.modifiedCount > 0 ||
    repository.untrackedCount > 0 ||
    repository.conflictedCount > 0;
}

function repositorySignature(repositories: GitRepositorySummary[]) {
  return JSON.stringify(repositories.map((repository) => [
    repository.repositoryRoot,
    repository.currentBranch,
    repository.stagedCount,
    repository.modifiedCount,
    repository.untrackedCount,
    repository.conflictedCount,
    repository.error,
  ]));
}

function areRepositoryStatusesEqual(
  left: RepositoryGitStatus[],
  right: RepositoryGitStatus[],
) {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useMultiRepositoryGitStatus(
  activeWorkspace: WorkspaceInfo | null,
  repositories: GitRepositorySummary[],
) {
  const [statuses, setStatuses] = useState<RepositoryGitStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const workspaceId = activeWorkspace?.id ?? null;
  const signature = useMemo(() => repositorySignature(repositories), [repositories]);
  const isMultiRepository = repositories.length > 1;

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!workspaceId || !isMultiRepository) {
      setStatuses([]);
      setIsLoading(false);
      return;
    }
    const dirtyRepositories = repositories
      .filter(hasRepositoryChanges)
      .sort((left, right) => {
        if (left.repositoryRoot === "") return -1;
        if (right.repositoryRoot === "") return 1;
        return left.repositoryRoot.localeCompare(right.repositoryRoot);
      });
    if (dirtyRepositories.length === 0) {
      setStatuses([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const results = await Promise.all(dirtyRepositories.map(async (repository) => {
      try {
        const status = await getGitStatus(workspaceId, repository.repositoryRoot);
        return {
          repositoryRoot: repository.repositoryRoot,
          displayName: repository.displayName,
          branchName: status.branchName || repository.currentBranch || "",
          stagedFiles: status.stagedFiles,
          unstagedFiles: status.unstagedFiles,
          totalAdditions: status.totalAdditions,
          totalDeletions: status.totalDeletions,
          error: null,
        } satisfies RepositoryGitStatus;
      } catch (error) {
        return {
          repositoryRoot: repository.repositoryRoot,
          displayName: repository.displayName,
          branchName: repository.currentBranch ?? "",
          stagedFiles: [],
          unstagedFiles: [],
          totalAdditions: 0,
          totalDeletions: 0,
          error: error instanceof Error ? error.message : String(error),
        } satisfies RepositoryGitStatus;
      }
    }));
    if (requestIdRef.current !== requestId) {
      return;
    }
    setStatuses((previous) =>
      areRepositoryStatusesEqual(previous, results) ? previous : results,
    );
    setIsLoading(false);
  }, [isMultiRepository, repositories, workspaceId]);

  useEffect(() => {
    // refresh 顶部已自增 requestIdRef 使旧请求失效,这里无需重复自增。
    void refresh();
  }, [refresh, signature, workspaceId]);

  return { statuses, isLoading, isMultiRepository, refresh };
}
