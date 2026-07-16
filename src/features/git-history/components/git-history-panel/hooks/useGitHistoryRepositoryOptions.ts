import { useEffect, useRef, useState } from "react";
import { listGitRepositorySummaries } from "../../../../../services/tauri";
import type { GitRepositorySummary, WorkspaceInfo } from "../../../../../types";

const HISTORY_REPOSITORY_SCAN_DEPTH = 2;

function areRepositorySummariesEqual(
  left: GitRepositorySummary[],
  right: GitRepositorySummary[],
) {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

type UseGitHistoryRepositoryOptionsProps = {
  workspace: WorkspaceInfo | null;
  repositoriesOverride?: GitRepositorySummary[];
  onError?: (message: string) => void;
};

export function useGitHistoryRepositoryOptions({
  workspace,
  repositoriesOverride,
  onError,
}: UseGitHistoryRepositoryOptionsProps) {
  const [repositories, setRepositories] = useState<GitRepositorySummary[]>(
    repositoriesOverride ?? [],
  );
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (repositoriesOverride) {
      // 同值守卫:调用方每渲染新建等值数组时保持旧引用,防渲染循环。
      setRepositories((previous) =>
        areRepositorySummariesEqual(previous, repositoriesOverride)
          ? previous
          : repositoriesOverride,
      );
      return;
    }
    if (!workspace) {
      setRepositories([]);
      return;
    }

    // 拉取期间不清空既有选项,由 requestId 保序让新结果覆盖,避免空闪。
    void listGitRepositorySummaries(workspace.id, HISTORY_REPOSITORY_SCAN_DEPTH)
      .then((summaries) => {
        if (requestIdRef.current === requestId) {
          setRepositories(summaries);
        }
      })
      .catch((error) => {
        if (requestIdRef.current === requestId) {
          setRepositories([]);
          onError?.(error instanceof Error ? error.message : String(error));
        }
      });
  }, [onError, repositoriesOverride, workspace]);

  return repositories;
}
