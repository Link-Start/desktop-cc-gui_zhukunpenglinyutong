import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setVisibilityGatedInterval } from "../../../services/visibilityGatedInterval";
import { readEngineTaskOutputArtifact } from "../../../services/tauri";
import type {
  EngineTaskOutputArtifactRefreshState,
  EngineTaskOutputSnapshot,
} from "../types";

const RUNNING_REFRESH_INTERVAL_MS = 5_000;

const EMPTY_REFRESH_STATE: EngineTaskOutputArtifactRefreshState = {
  isRefreshing: false,
  lastRefreshedAt: null,
  error: null,
  truncated: false,
  source: "snapshot",
};

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Task output is unavailable.";
}

type UseEngineTaskOutputSnapshotInput = {
  workspaceId?: string | null;
  snapshot: EngineTaskOutputSnapshot | null;
};

export function useEngineTaskOutputSnapshot({
  workspaceId,
  snapshot,
}: UseEngineTaskOutputSnapshotInput) {
  const requestIdRef = useRef(0);
  const [artifactOutput, setArtifactOutput] = useState<string | null>(null);
  const [refreshState, setRefreshState] =
    useState<EngineTaskOutputArtifactRefreshState>(EMPTY_REFRESH_STATE);

  const workspaceIdValue = workspaceId?.trim() ?? "";
  const artifactPath = snapshot?.outputFilePath?.trim() ?? "";
  const refreshKey = `${snapshot?.id ?? ""}\u0000${artifactPath}`;

  useEffect(() => {
    setArtifactOutput(null);
    setRefreshState(EMPTY_REFRESH_STATE);
  }, [refreshKey]);

  const refresh = useCallback(async () => {
    if (!snapshot || !workspaceIdValue || !artifactPath) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setRefreshState((current) => ({
      ...current,
      isRefreshing: true,
      error: null,
    }));

    try {
      const response = await readEngineTaskOutputArtifact({
        workspaceId: workspaceIdValue,
        path: artifactPath,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      const nextOutput = response.content.trim();
      setArtifactOutput(nextOutput.length > 0 ? nextOutput : null);
      setRefreshState({
        isRefreshing: false,
        lastRefreshedAt: Date.now(),
        error: null,
        truncated: response.truncated,
        source: response.exists ? "artifact" : "unavailable",
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setRefreshState({
        isRefreshing: false,
        lastRefreshedAt: Date.now(),
        error: normalizeErrorMessage(error),
        truncated: false,
        source: "unavailable",
      });
    }
  }, [artifactPath, snapshot, workspaceIdValue]);

  useEffect(() => {
    if (!snapshot || !workspaceIdValue || !artifactPath) {
      return undefined;
    }

    let cancelled = false;
    const runRefresh = () => {
      if (!cancelled) {
        void refresh();
      }
    };

    runRefresh();
    if (snapshot.status !== "running") {
      return () => {
        cancelled = true;
        requestIdRef.current += 1;
      };
    }

    // running 期间周期性拉取产物文件；窗口隐藏时暂停，恢复可见时 gated 版
    // 会先立即补一次 tick，语义与"始终最新"一致。
    const cleanupInterval = setVisibilityGatedInterval(
      runRefresh,
      RUNNING_REFRESH_INTERVAL_MS,
    );
    return () => {
      cancelled = true;
      requestIdRef.current += 1;
      cleanupInterval();
    };
  }, [artifactPath, refresh, snapshot, workspaceIdValue]);

  const resolvedSnapshot = useMemo(() => {
    if (!snapshot || !artifactOutput) {
      return snapshot;
    }
    return {
      ...snapshot,
      recentOutput: artifactOutput,
    };
  }, [artifactOutput, snapshot]);

  return {
    snapshot: resolvedSnapshot,
    refresh,
    refreshState,
  };
}

export const engineTaskOutputHookInternals = {
  RUNNING_REFRESH_INTERVAL_MS,
};
