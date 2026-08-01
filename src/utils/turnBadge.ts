import type { EngineType } from "../types";

export type TurnBadgeSnapshot = {
  engine: EngineType;
  providerProfileId?: string | null;
  model?: string | null;
  reasoning?: { effort: string } | null;
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: string | null;
};

export type TurnBadgeUnavailableReason =
  | "provider-deleted"
  | "provider-missing"
  | "runtime-missing";

export type TurnBadgeModel = {
  engine: EngineType;
  engineLabel: string;
  providerLabel: string;
  modelLabel: string | null;
  reasoningLabel: string | null;
  unavailable: boolean;
  unavailableReason: TurnBadgeUnavailableReason | null;
};

export type TurnBadgeAvailability = {
  providerExists: boolean;
  providerAvailable: boolean;
  runtimeAvailable: boolean;
};

const FULLY_AVAILABLE: TurnBadgeAvailability = {
  providerExists: true,
  providerAvailable: true,
  runtimeAvailable: true,
};

export const LOCAL_PROVIDER_LABEL = "本地配置";
export const LOCAL_PROVIDER_SOURCE = "disk";

function resolveEngineLabel(engine: EngineType): string {
  switch (engine) {
    case "claude":
      return "Claude Code";
    case "codex":
      return "Codex CLI";
    case "kimi":
      return "Kimi CLI";
    case "gemini":
      return "Gemini CLI";
    case "grok":
      return "Grok CLI";
    case "opencode":
      return "OpenCode";
  }
}

export function resolveSnapshotProviderLabel(
  snapshot: TurnBadgeSnapshot,
): string {
  const name = snapshot.providerProfileNameSnapshot?.trim();
  if (name) {
    return name;
  }
  const id = snapshot.providerProfileId?.trim();
  if (id) {
    return id;
  }
  return snapshot.providerProfileSource?.trim() === "disk" ||
    snapshot.providerProfileSource?.trim() === "local"
    ? LOCAL_PROVIDER_LABEL
    : "历史配置未知";
}

export function resolveTurnBadge(
  snapshot: TurnBadgeSnapshot,
  availability: TurnBadgeAvailability = FULLY_AVAILABLE,
): TurnBadgeModel {
  let unavailableReason: TurnBadgeUnavailableReason | null = null;
  if (!availability.providerExists) {
    unavailableReason = "provider-deleted";
  } else if (!availability.providerAvailable) {
    unavailableReason = "provider-missing";
  } else if (!availability.runtimeAvailable) {
    unavailableReason = "runtime-missing";
  }

  return {
    engine: snapshot.engine,
    engineLabel: resolveEngineLabel(snapshot.engine),
    providerLabel: resolveSnapshotProviderLabel(snapshot),
    modelLabel: snapshot.model?.trim() || null,
    reasoningLabel: snapshot.reasoning?.effort?.trim() || null,
    unavailable: unavailableReason !== null,
    unavailableReason,
  };
}
