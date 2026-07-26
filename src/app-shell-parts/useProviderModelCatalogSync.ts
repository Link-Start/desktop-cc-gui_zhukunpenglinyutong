import { useEffect, useRef } from "react";
import type { useEngineController } from "../features/engine/hooks/useEngineController";
import type { DebugEntry, EngineType } from "../types";

type EngineControllerSection = ReturnType<typeof useEngineController>;

type ProviderModelCatalogSyncParams = {
  activeEngine: EngineType;
  activeThreadId: string | null | undefined;
  activeWorkspaceId: string | null | undefined;
  providerProfileId: string | null | undefined;
  addDebugEntry: (entry: DebugEntry) => void;
  refreshEngineModels: EngineControllerSection["refreshEngineModels"];
};

const PROVIDER_SCOPED_ENGINES = new Set<EngineType>([
  "claude",
  "codex",
  "kimi",
]);

export function useProviderModelCatalogSync({
  activeEngine,
  activeThreadId,
  activeWorkspaceId,
  providerProfileId,
  addDebugEntry,
  refreshEngineModels,
}: ProviderModelCatalogSyncParams) {
  const activeCatalogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const normalizedThreadId = activeThreadId?.trim();
    if (!normalizedThreadId || !PROVIDER_SCOPED_ENGINES.has(activeEngine)) {
      return;
    }
    const normalizedProviderProfileId = providerProfileId?.trim() || null;
    const catalogKey = `${activeWorkspaceId ?? "unknown"}:${activeEngine}:${
      normalizedProviderProfileId ?? "__global__"
    }`;
    if (activeCatalogKeyRef.current === catalogKey) {
      return;
    }
    activeCatalogKeyRef.current = catalogKey;
    addDebugEntry({
      id: `${Date.now()}-provider-model-catalog-sync`,
      timestamp: Date.now(),
      source: "client",
      label: "engine/models sync active provider",
      payload: {
        workspaceId: activeWorkspaceId,
        threadId: normalizedThreadId,
        engine: activeEngine,
        providerProfileId: normalizedProviderProfileId,
      },
    });
    void refreshEngineModels(activeEngine, {
      providerProfileId: normalizedProviderProfileId,
    });
  }, [
    activeEngine,
    activeThreadId,
    activeWorkspaceId,
    addDebugEntry,
    providerProfileId,
    refreshEngineModels,
  ]);
}
