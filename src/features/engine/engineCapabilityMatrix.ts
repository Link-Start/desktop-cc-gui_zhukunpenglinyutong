import type { EngineFeatures, EngineStatus, EngineType } from "../../types";
import {
  GENERATED_ENGINE_CAPABILITY_KEYS,
  GENERATED_ENGINE_CAPABILITY_MATRIX,
  type GeneratedEngineCapabilityKey,
  type GeneratedEngineCapabilityState,
} from "./generated/engineCapabilityMatrix.generated";

export type EngineCapabilityState = GeneratedEngineCapabilityState;
export type EngineCapabilityKey = GeneratedEngineCapabilityKey;

export type EngineCapabilityRuntimeStatus = {
  engine: EngineType;
  capability: EngineCapabilityKey;
  specState: EngineCapabilityState;
  runtimeState: EngineCapabilityState;
  available: boolean;
  reason: string | null;
};

export const ENGINE_CAPABILITY_KEYS = GENERATED_ENGINE_CAPABILITY_KEYS;

export function getEngineCapabilityState(
  engine: EngineType,
  capability: EngineCapabilityKey,
): EngineCapabilityState {
  return GENERATED_ENGINE_CAPABILITY_MATRIX[engine]?.[capability] ?? "unknown";
}

export function isEngineCapabilityAvailable(
  engine: EngineType,
  capability: EngineCapabilityKey,
): boolean {
  return getEngineCapabilityState(engine, capability) === "supported";
}

export function projectEngineFeaturesToCapabilityStates(
  features: EngineFeatures,
): Record<EngineCapabilityKey, EngineCapabilityState> {
  const reasoning = features.reasoningEffort ?? features.reasoning;
  const toolUse = features.toolsControl ?? features.toolUse;
  const sessionResume = features.sessionResume ?? features.sessionContinuation;
  const boolState = (value: boolean | undefined): EngineCapabilityState =>
    value === undefined ? "unknown" : value ? "supported" : "unsupported";
  return {
    "streaming.text": boolState(features.streaming),
    "streaming.reasoning":
      features.streaming === false ? "unsupported" : boolState(reasoning),
    "streaming.tool-output":
      features.streaming === false ? "unsupported" : boolState(toolUse),
    "tool.use": boolState(toolUse),
    "tool.mcp": boolState(features.mcp),
    "reasoning.effort": boolState(reasoning),
    "collaboration.mode": boolState(features.collaborationMode),
    "session.continuation": boolState(sessionResume),
    "image.input": boolState(features.imageInput),
    "input.mid-turn": "unknown",
    "session.resume": boolState(sessionResume),
    "session.fork": "unknown",
    "session.switch": "unknown",
    "session.tree": "unknown",
    "rpc.server": "unknown",
  };
}

export function resolveEngineCapabilityRuntimeStatus(
  status: Pick<EngineStatus, "engineType" | "features">,
  capability: EngineCapabilityKey,
): EngineCapabilityRuntimeStatus {
  const specState = getEngineCapabilityState(status.engineType, capability);
  const runtimeState = projectEngineFeaturesToCapabilityStates(status.features)[capability];
  const available = specState === "supported" && runtimeState !== "unsupported";
  return {
    engine: status.engineType,
    capability,
    specState,
    runtimeState,
    available,
    reason:
      specState !== "supported"
        ? `spec:${specState}`
        : runtimeState === "unsupported"
          ? "runtime:unsupported"
          : runtimeState === "unknown"
            ? "runtime:evidence-missing"
            : null,
  };
}
