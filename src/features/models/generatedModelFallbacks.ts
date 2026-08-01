import type { EngineType } from "../../types";
import generatedCatalog from "./generatedModelCatalog.json";

export type GeneratedModelFallback = Readonly<{
  id: string;
  label: string;
  description: string;
  provider: string;
  protocol: string;
  lifecycle: string;
  default?: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: readonly {
    reasoningEffort: string;
    description: string;
  }[];
}>;

export const GENERATED_MODEL_FALLBACKS = generatedCatalog.engines as Readonly<
  Partial<Record<EngineType, readonly GeneratedModelFallback[]>>
>;

export function getGeneratedModelFallbacks(
  engine: EngineType,
): readonly GeneratedModelFallback[] {
  return GENERATED_MODEL_FALLBACKS[engine] ?? [];
}
