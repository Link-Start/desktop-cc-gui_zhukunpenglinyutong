import { useEffect, useRef } from "react";
import type { useEngineController } from "../features/engine/hooks/useEngineController";
import type { DebugEntry, EngineType } from "../types";

type EngineControllerSection = ReturnType<typeof useEngineController>;

type ProviderModelCatalogSyncParams = {
  activeEngine: EngineType;
  activeThreadEngineSource: EngineType | null | undefined;
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
  activeThreadEngineSource,
  activeThreadId,
  activeWorkspaceId,
  providerProfileId,
  addDebugEntry,
  refreshEngineModels,
}: ProviderModelCatalogSyncParams) {
  const activeCatalogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const normalizedThreadId = activeThreadId?.trim();
    const normalizedProviderProfileId = providerProfileId?.trim() || null;
    const catalogEngine =
      activeThreadEngineSource ??
      (normalizedProviderProfileId ? null : activeEngine);
    if (
      !normalizedThreadId ||
      !catalogEngine ||
      !PROVIDER_SCOPED_ENGINES.has(catalogEngine)
    ) {
      return;
    }
    const catalogKey = `${activeWorkspaceId ?? "unknown"}:${catalogEngine}:${
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
        engine: catalogEngine,
        providerProfileId: normalizedProviderProfileId,
      },
    });
    void refreshEngineModels(catalogEngine, {
      providerProfileId: normalizedProviderProfileId,
    });
  }, [
    activeEngine,
    activeThreadEngineSource,
    activeThreadId,
    activeWorkspaceId,
    addDebugEntry,
    providerProfileId,
    refreshEngineModels,
  ]);
}
