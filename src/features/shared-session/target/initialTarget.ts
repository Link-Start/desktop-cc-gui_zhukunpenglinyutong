import type { EngineModelInfo } from "../../../types";
import type { SharedSessionSupportedEngine } from "../utils/sharedSessionEngines";

import type { ExecutionTarget } from "./types";

export function buildLocalSharedSessionInitialTarget(
  engine: SharedSessionSupportedEngine,
  models: EngineModelInfo[],
  localProviderName: string,
  unavailableModelMessage: string,
): ExecutionTarget {
  const selectedModel =
    models.find((model) => model.isDefault) ?? models[0] ?? null;
  const modelCatalogEntryId = selectedModel?.id.trim() ?? "";
  const runtimeModel =
    selectedModel?.model?.trim() || modelCatalogEntryId;
  if (!modelCatalogEntryId || !runtimeModel) {
    throw new Error(unavailableModelMessage);
  }

  return {
    engine,
    providerProfileId: null,
    modelCatalogEntryId,
    model: runtimeModel,
    reasoning: null,
    providerProfileNameSnapshot: localProviderName.trim() || "本地配置",
    providerProfileSource: "disk",
  };
}
