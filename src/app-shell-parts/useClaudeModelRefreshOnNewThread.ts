import { useEffect, useRef } from "react";
import { resolveClaudePendingThreadModelRefreshKey } from "../features/engine/utils/claudeModelRefresh";
import type { useEngineController } from "../features/engine/hooks/useEngineController";
import type { DebugEntry } from "../types";

type RefreshKeyOptions = Parameters<
  typeof resolveClaudePendingThreadModelRefreshKey
>[0];

type EngineControllerSection = ReturnType<typeof useEngineController>;

type ClaudeModelRefreshOnNewThreadParams = {
  activeEngine: RefreshKeyOptions["activeEngine"];
  activeThreadId: RefreshKeyOptions["activeThreadId"];
  activeWorkspaceId: RefreshKeyOptions["activeWorkspaceId"];
  addDebugEntry: (entry: DebugEntry) => void;
  refreshEngineModels: EngineControllerSection["refreshEngineModels"];
};

export function useClaudeModelRefreshOnNewThread({
  activeEngine,
  activeThreadId,
  activeWorkspaceId,
  addDebugEntry,
  refreshEngineModels,
}: ClaudeModelRefreshOnNewThreadParams) {
  const claudeModelRefreshThreadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const refreshKey = resolveClaudePendingThreadModelRefreshKey({
      activeEngine,
      activeThreadId,
      activeWorkspaceId,
    });
    if (!refreshKey) {
      return;
    }
    if (claudeModelRefreshThreadKeyRef.current === refreshKey) {
      return;
    }
    claudeModelRefreshThreadKeyRef.current = refreshKey;
    addDebugEntry({
      id: `${Date.now()}-claude-model-refresh-on-new-thread`,
      timestamp: Date.now(),
      source: "client",
      label: "engine/models refresh on new claude thread",
      payload: { workspaceId: activeWorkspaceId, threadId: activeThreadId },
    });
    void refreshEngineModels("claude");
  }, [
    activeEngine,
    activeThreadId,
    activeWorkspaceId,
    addDebugEntry,
    refreshEngineModels,
  ]);
}
