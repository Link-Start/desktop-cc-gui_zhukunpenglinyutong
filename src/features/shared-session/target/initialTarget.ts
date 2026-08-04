import type { EngineModelInfo } from "../../../types";
import { resolveAtomicReasoningEffort } from "../../models/atomicModelReasoning";
import type { SharedSessionSupportedEngine } from "../utils/sharedSessionEngines";

import type { ExecutionTarget } from "./types";

/**
 * Shared 本地默认 Target。
 *
 * 纪律：只信「本 CLI 的 model catalog 默认行」，禁止借用全局/Native
 * composer 的 model 或 effort（Native Codex 残留会污染 Grok/Claude 初始化）。
 */
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

  // 按目标 engine+model capability 播种；禁止 inherit 全局 Native effort。
  const seededEffort = resolveAtomicReasoningEffort({
    engine,
    model: {
      id: modelCatalogEntryId,
      model: runtimeModel,
      source: selectedModel?.source ?? null,
    },
    previousEffort: null,
    inherit: false,
  });

  return {
    engine,
    providerProfileId: null,
    modelCatalogEntryId,
    model: runtimeModel,
    reasoning: seededEffort ? { effort: seededEffort } : null,
    providerProfileNameSnapshot: localProviderName.trim() || "本地配置",
    providerProfileSource: "disk",
  };
}
