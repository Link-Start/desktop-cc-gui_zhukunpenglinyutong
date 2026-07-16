import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGitFileBlame } from "../../../services/tauri";
import type { GitFileBlameResponse } from "../../../types";
import { normalizeGitBlameResponse } from "../utils/gitBlame";

export type FileGitBlameStatus = "disabled" | "loading" | "ready" | "stale" | "error";

type FileGitBlameSnapshot = {
  key: string;
  status: Exclude<FileGitBlameStatus, "disabled">;
  response: GitFileBlameResponse | null;
  error: string | null;
};

type UseFileGitBlameArgs = {
  workspaceId: string;
  repositoryRoot: string | null;
  path: string;
  renderToken: string;
  eligible: boolean;
  isDirty: boolean;
};

const FILE_GIT_BLAME_CACHE_MAX_ENTRIES = 12;
const fileGitBlameCache = new Map<string, GitFileBlameResponse>();

function readCachedBlame(key: string) {
  const cached = fileGitBlameCache.get(key) ?? null;
  if (cached) {
    fileGitBlameCache.delete(key);
    fileGitBlameCache.set(key, cached);
  }
  return cached;
}

function writeCachedBlame(key: string, response: GitFileBlameResponse) {
  fileGitBlameCache.delete(key);
  fileGitBlameCache.set(key, response);
  while (fileGitBlameCache.size > FILE_GIT_BLAME_CACHE_MAX_ENTRIES) {
    const oldestKey = fileGitBlameCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    fileGitBlameCache.delete(oldestKey);
  }
}

export function clearFileGitBlameCacheForTests() {
  fileGitBlameCache.clear();
}

export function useFileGitBlame({
  workspaceId,
  repositoryRoot,
  path,
  renderToken,
  eligible,
  isDirty,
}: UseFileGitBlameArgs) {
  const fileKey = useMemo(
    () => [workspaceId, repositoryRoot ?? "", path].join("\u001f"),
    [path, repositoryRoot, workspaceId],
  );
  const snapshotKey = useMemo(
    () => `${fileKey}\u001f${renderToken}`,
    [fileKey, renderToken],
  );
  const [enabledKey, setEnabledKey] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FileGitBlameSnapshot | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const requestIdRef = useRef(0);
  const loadedRequestKeyRef = useRef<string | null>(null);
  const enabled = eligible && enabledKey === fileKey;

  const toggle = useCallback(() => {
    setEnabledKey((current) => (current === fileKey ? null : fileKey));
  }, [fileKey]);

  const refresh = useCallback(() => {
    fileGitBlameCache.delete(snapshotKey);
    loadedRequestKeyRef.current = null;
    setRefreshRevision((current) => current + 1);
  }, [snapshotKey]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      return;
    }
    if (isDirty) {
      requestIdRef.current += 1;
      setSnapshot((current) => ({
        key: snapshotKey,
        status: "stale",
        response: current?.key === snapshotKey ? current.response : null,
        error: null,
      }));
      return;
    }

    const requestKey = `${snapshotKey}\u001f${refreshRevision}`;
    if (loadedRequestKeyRef.current === requestKey) {
      return;
    }
    loadedRequestKeyRef.current = requestKey;
    const cached = readCachedBlame(snapshotKey);
    if (cached) {
      setSnapshot({ key: snapshotKey, status: "ready", response: cached, error: null });
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    let cancelled = false;
    setSnapshot((current) => ({
      key: snapshotKey,
      status: "loading",
      response: current?.key === snapshotKey ? current.response : null,
      error: null,
    }));
    getGitFileBlame(workspaceId, path, repositoryRoot)
      .then((response) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        const normalized = normalizeGitBlameResponse(response);
        writeCachedBlame(snapshotKey, normalized);
        setSnapshot({ key: snapshotKey, status: "ready", response: normalized, error: null });
      })
      .catch((error) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        setSnapshot({
          key: snapshotKey,
          status: "error",
          response: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, isDirty, path, refreshRevision, repositoryRoot, snapshotKey, workspaceId]);

  if (!enabled) {
    return {
      enabled: false,
      status: "disabled" as const,
      response: null,
      error: null,
      toggle,
      refresh,
    };
  }
  const currentSnapshot = snapshot?.key === snapshotKey ? snapshot : null;
  return {
    enabled: true,
    status: currentSnapshot?.status ?? (isDirty ? "stale" : "loading"),
    response: currentSnapshot?.response ?? null,
    error: currentSnapshot?.error ?? null,
    toggle,
    refresh,
  };
}
