import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BranchInfo,
  DebugEntry,
  GitBranchListItem,
  WorkspaceInfo,
} from "../../../types";
import {
  checkoutGitBranch,
  createGitBranch,
  listGitBranches,
  updateGitBranch,
} from "../../../services/tauri";
import { normalizeGitBranchListResponse } from "../utils/gitBranchList";

type UseGitBranchesOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
  repositoryRoot?: string | null;
  onMutationComplete?: () => Promise<void> | void;
};

export function useGitBranches({
  activeWorkspace,
  onDebug,
  repositoryRoot,
  onMutationComplete,
}: UseGitBranchesOptions) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [localBranches, setLocalBranches] = useState<GitBranchListItem[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<GitBranchListItem[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedScope = useRef<string | null>(null);
  const inFlightScope = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const lastFailureSignature = useRef<{
    signature: string;
    count: number;
    emittedAt: number;
  } | null>(null);

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);
  const scopeKey = workspaceId
    ? `${workspaceId}:${repositoryRoot === undefined ? "configured" : repositoryRoot ?? "configured"}`
    : null;

  const refreshBranches = useCallback(async () => {
    if (!workspaceId || !isConnected) {
      setBranches([]);
      return;
    }
    if (!scopeKey || inFlightScope.current === scopeKey) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightScope.current = scopeKey;
    onDebug?.({
      id: `${Date.now()}-client-branches-list`,
      timestamp: Date.now(),
      source: "client",
      label: "git/branches/list",
      payload: { workspaceId },
    });
    try {
      const response = await listGitBranches(workspaceId, repositoryRoot);
      const normalized = normalizeGitBranchListResponse(response);
      if (requestIdRef.current !== requestId) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-server-branches-list`,
        timestamp: Date.now(),
        source: "server",
        label: "git/branches/list response",
        payload: response,
      });
      if (normalized.repositoryState === "not_git_repository") {
        setBranches([]);
        setLocalBranches([]);
        setRemoteBranches([]);
        setCurrentBranch(null);
        lastFetchedScope.current = scopeKey;
        setError(null);
        onDebug?.({
          id: `${Date.now()}-server-branches-not-repository`,
          timestamp: Date.now(),
          source: "server",
          label: "git/branches/not-repository",
          payload: normalized.diagnostic ?? { workspaceId },
        });
        return;
      }
      setBranches(normalized.branches);
      setLocalBranches(normalized.localBranches);
      setRemoteBranches(normalized.remoteBranches);
      setCurrentBranch(normalized.currentBranch);
      lastFetchedScope.current = scopeKey;
      setError(null);
      lastFailureSignature.current = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(message);
      const signature = `${workspaceId}:${message}`;
      const now = Date.now();
      const previous = lastFailureSignature.current;
      const nextCount = previous?.signature === signature ? previous.count + 1 : 1;
      const shouldEmit =
        !previous ||
        previous.signature !== signature ||
        now - previous.emittedAt > 60_000 ||
        nextCount === 5;
      lastFailureSignature.current = {
        signature,
        count: nextCount,
        emittedAt: shouldEmit ? now : previous?.emittedAt ?? now,
      };
      if (shouldEmit) {
        onDebug?.({
          id: `${Date.now()}-client-branches-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "git/branches/list error",
          payload: {
            workspaceId,
            message,
            repeatedCount: nextCount,
            dedupeWindowMs: 60_000,
          },
        });
      }
    } finally {
      if (inFlightScope.current === scopeKey) {
        inFlightScope.current = null;
      }
    }
  }, [isConnected, onDebug, repositoryRoot, scopeKey, workspaceId]);

  useEffect(() => {
    requestIdRef.current += 1;
    setBranches([]);
    setLocalBranches([]);
    setRemoteBranches([]);
    setCurrentBranch(null);
    setError(null);
  }, [scopeKey]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastFetchedScope.current === scopeKey && branches.length > 0) {
      return;
    }
    refreshBranches();
  }, [branches.length, isConnected, refreshBranches, scopeKey, workspaceId]);

  const recentBranches = useMemo(
    () => branches.slice().sort((a, b) => b.lastCommit - a.lastCommit),
    [branches],
  );

  const checkoutBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-client-branch-checkout`,
        timestamp: Date.now(),
        source: "client",
        label: "git/branch/checkout",
        payload: { workspaceId, name },
      });
      await checkoutGitBranch(workspaceId, name, repositoryRoot);
      await refreshBranches();
      await onMutationComplete?.();
    },
    [onDebug, onMutationComplete, refreshBranches, repositoryRoot, workspaceId],
  );

  const createBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-client-branch-create`,
        timestamp: Date.now(),
        source: "client",
        label: "git/branch/create",
        payload: { workspaceId, name },
      });
      await createGitBranch(workspaceId, name, repositoryRoot);
      await refreshBranches();
      await onMutationComplete?.();
    },
    [onDebug, onMutationComplete, refreshBranches, repositoryRoot, workspaceId],
  );

  const updateBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return null;
      }
      const result = await updateGitBranch(workspaceId, name, repositoryRoot);
      await refreshBranches();
      await onMutationComplete?.();
      return result;
    },
    [onMutationComplete, refreshBranches, repositoryRoot, workspaceId],
  );

  return {
    branches: recentBranches,
    localBranches,
    remoteBranches,
    currentBranch,
    error,
    refreshBranches,
    checkoutBranch,
    createBranch,
    updateBranch,
  };
}
