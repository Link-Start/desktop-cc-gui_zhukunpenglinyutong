import generatedCatalog from "./generatedModelCatalog.json";
import { getGeneratedModelFallbacks } from "./generatedModelFallbacks";
import type { ModelCatalogEntry } from "./modelProviderCatalog";

export type CodexModelCatalogEntry = {
  id: string;
  label: string;
  description: string;
  provider: string;
  protocol: string;
  source: "fallback";
  provenance: string;
  lifecycle: string;
  lastVerifiedAt: string;
  supportedReasoningEfforts?: { reasoningEffort: string; description: string }[];
  defaultReasoningEffort?: string | null;
};

export const CODEX_MODEL_CATALOG: CodexModelCatalogEntry[] =
  getGeneratedModelFallbacks("codex").map((model) => ({
    ...model,
    source: "fallback",
    provenance: "generated:model-catalog",
    lastVerifiedAt: generatedCatalog.lastVerifiedAt,
    supportedReasoningEfforts: model.supportedReasoningEfforts
      ? [...model.supportedReasoningEfforts]
      : undefined,
  }));

export const CODEX_MODEL_FALLBACK_ENTRIES: readonly ModelCatalogEntry[] =
  Object.freeze(
    CODEX_MODEL_CATALOG.map((model) =>
      Object.freeze({
        ...model,
        engine: "codex" as const,
      }),
    ),
  );
