import { useCallback, useEffect, useRef, useState } from "react";
import type { DebugEntry, GitRepositorySummary, WorkspaceInfo } from "../../../types";
import { listGitRepositorySummaries } from "../../../services/tauri";
import {
  areGitRepositorySummariesEqual,
  normalizeGitRepositorySummaries,
} from "../utils/gitRepositorySummary";

const FALLBACK_REFRESH_INTERVAL_MS = 45_000;
const DEFAULT_SCAN_DEPTH = 2;

type UseGitRepositoriesOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
};

export function useGitRepositories({
  activeWorkspace,
  onDebug,
}: UseGitRepositoriesOptions) {
  const [repositories, setRepositories] = useState<GitRepositorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const workspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const consecutiveEmptyResponsesRef = useRef(0);
  const acceptedRepositoriesRef = useRef<GitRepositorySummary[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);

  const refreshRepositories = useCallback(() => {
    if (!workspaceId || !isConnected) {
      acceptedRepositoriesRef.current = [];
      consecutiveEmptyResponsesRef.current = 0;
      hasLoadedOnceRef.current = false;
      setRepositories([]);
      return Promise.resolve();
    }
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    // 已有数据后的兜底轮询不再翻转 isLoading,避免 45s 一次的 true→false 双根渲染。
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    const request = (async () => {
      try {
        const response = await listGitRepositorySummaries(
          workspaceId,
          DEFAULT_SCAN_DEPTH,
        );
        if (
          requestIdRef.current !== requestId ||
          workspaceIdRef.current !== workspaceId
        ) {
          return;
        }
        const normalized = normalizeGitRepositorySummaries(response);
        const current = acceptedRepositoriesRef.current;
        let accepted = normalized;
        if (normalized.length === 0 && current.length > 0) {
          consecutiveEmptyResponsesRef.current += 1;
          if (consecutiveEmptyResponsesRef.current === 1) {
            accepted = current;
          }
        } else {
          consecutiveEmptyResponsesRef.current = 0;
        }
        acceptedRepositoriesRef.current = accepted;
        hasLoadedOnceRef.current = true;
        setRepositories((rendered) =>
          areGitRepositorySummariesEqual(rendered, accepted) ? rendered : accepted,
        );
        setError(null);
      } catch (caughtError) {
        if (
          requestIdRef.current !== requestId ||
          workspaceIdRef.current !== workspaceId
        ) {
          return;
        }
        const message =
          caughtError instanceof Error ? caughtError.message : String(caughtError);
        setError(message);
        onDebug?.({
          id: `${Date.now()}-git-repositories-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "git/repositories/list error",
          payload: { workspaceId, message },
        });
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = request;
    return request;
  }, [isConnected, onDebug, workspaceId]);

  useEffect(() => {
    if (workspaceIdRef.current === workspaceId) {
      return;
    }
    workspaceIdRef.current = workspaceId;
    requestIdRef.current += 1;
    inFlightRef.current = null;
    consecutiveEmptyResponsesRef.current = 0;
    acceptedRepositoriesRef.current = [];
    hasLoadedOnceRef.current = false;
    setRepositories([]);
    setError(null);
    setIsLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    let cancelled = false;
    let timeoutId = 0;
    const schedule = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        if (document.visibilityState === "visible") {
          void refreshRepositories().finally(schedule);
        } else {
          schedule();
        }
      }, FALLBACK_REFRESH_INTERVAL_MS);
    };
    void refreshRepositories().finally(schedule);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isConnected, refreshRepositories, workspaceId]);

  return {
    repositories,
    error,
    isLoading,
    refreshRepositories,
  };
}
