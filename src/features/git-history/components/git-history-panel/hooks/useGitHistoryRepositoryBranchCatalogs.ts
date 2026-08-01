import { useEffect, useRef, useState } from "react";
import { listGitBranches } from "../../../../../services/tauri";
import type { GitBranchListItem, GitRepositorySummary } from "../../../../../types";

export type GitHistoryRepositoryBranchCatalog = {
  repositoryRoot: string;
  localBranches: GitBranchListItem[];
  remoteBranches: GitBranchListItem[];
  currentBranch: string | null;
  status: "loading" | "ready" | "error";
  error: string | null;
};

type UseGitHistoryRepositoryBranchCatalogsProps = {
  workspaceId: string | null;
  repositories: readonly GitRepositorySummary[];
  enabled: boolean;
  refreshKey?: number;
};

function buildLoadingCatalogs(
  repositories: readonly GitRepositorySummary[],
): Map<string, GitHistoryRepositoryBranchCatalog> {
  return new Map(repositories.map((repository) => [repository.repositoryRoot, {
    repositoryRoot: repository.repositoryRoot,
    localBranches: [],
    remoteBranches: [],
    currentBranch: repository.currentBranch,
    status: "loading" as const,
    error: null,
  }]));
}

export function buildSingleRepositoryBranchCatalog(
  repository: GitRepositorySummary,
  localBranches: GitBranchListItem[],
  remoteBranches: GitBranchListItem[],
  currentBranch: string | null,
) {
  return new Map([[repository.repositoryRoot, {
    repositoryRoot: repository.repositoryRoot,
    localBranches,
    remoteBranches,
    currentBranch: currentBranch ?? repository.currentBranch,
    status: "ready" as const,
    error: null,
  }]]);
}

export function useGitHistoryRepositoryBranchCatalogs({
  workspaceId,
  repositories,
  enabled,
  refreshKey = 0,
}: UseGitHistoryRepositoryBranchCatalogsProps) {
  const [catalogs, setCatalogs] = useState<Map<string, GitHistoryRepositoryBranchCatalog>>(
    () => new Map(),
  );
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!enabled || !workspaceId || repositories.length === 0) {
      setCatalogs(new Map());
      return;
    }

    setCatalogs(buildLoadingCatalogs(repositories));
    void Promise.allSettled(
      repositories.map((repository) => listGitBranches(workspaceId, repository.repositoryRoot)),
    ).then((results) => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setCatalogs(new Map<string, GitHistoryRepositoryBranchCatalog>(repositories.map(
        (repository, index): [string, GitHistoryRepositoryBranchCatalog] => {
          const result = results[index];
          if (result.status === "rejected") {
            return [repository.repositoryRoot, {
              repositoryRoot: repository.repositoryRoot,
              localBranches: [],
              remoteBranches: [],
              currentBranch: repository.currentBranch,
              status: "error" as const,
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            }];
          }
          const response = result.value;
          if (response.repositoryState && response.repositoryState !== "git_repository") {
            return [repository.repositoryRoot, {
              repositoryRoot: repository.repositoryRoot,
              localBranches: [],
              remoteBranches: [],
              currentBranch: response.currentBranch ?? repository.currentBranch,
              status: "error" as const,
              error: response.diagnostic?.message ?? response.diagnostic?.reason ?? null,
            }];
          }
          return [repository.repositoryRoot, {
            repositoryRoot: repository.repositoryRoot,
            localBranches: response.localBranches ?? [],
            remoteBranches: response.remoteBranches ?? [],
            currentBranch: response.currentBranch ?? repository.currentBranch,
            status: "ready" as const,
            error: null,
          }];
        },
      )));
    });
    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [enabled, refreshKey, repositories, workspaceId]);

  return catalogs;
}
