import { useEffect, useRef, useState } from "react";
import { listGitRepositorySummaries } from "../../../../../services/tauri";
import type { GitRepositorySummary, WorkspaceInfo } from "../../../../../types";

const HISTORY_REPOSITORY_SCAN_DEPTH = 2;

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
      setRepositories(repositoriesOverride);
      return;
    }
    if (!workspace) {
      setRepositories([]);
      return;
    }

    setRepositories([]);
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
