import type { EngineType } from "../../../types";
import { ENABLED_ENGINE_TYPES } from "../hooks/engineControllerAvailability";
import { isSupportedEngineType } from "../engineRegistry";

export type FallbackEngineCandidate = {
  type: EngineType;
  installed: boolean;
};

function toDisabledSet(
  disabledCliEngineIds: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> {
  if (!disabledCliEngineIds) {
    return new Set();
  }
  if (disabledCliEngineIds instanceof Set) {
    return disabledCliEngineIds;
  }
  const ids = disabledCliEngineIds as readonly string[];
  return new Set(
    ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean),
  );
}

/**
 * When the current active engine is user-disabled in CLI settings, pick the
 * first still-enabled + installed engine (registry order). Returns null when
 * no migration is needed or no fallback exists.
 *
 * In-progress threads that still bind to the disabled engine may keep it so
 * history / mid-turn work is not yanked; home and new-session surfaces must
 * migrate so the default model follows an available CLI.
 */
export function resolveFallbackEngineWhenDisabled(options: {
  activeEngine: EngineType;
  disabledCliEngineIds?: ReadonlySet<string> | readonly string[];
  candidates: readonly FallbackEngineCandidate[];
  /**
   * True when the open thread is still bound to the (disabled) active engine.
   * Home / empty composer pass false so defaults migrate immediately.
   */
  preserveDisabledActiveEngine?: boolean;
  preferredOrder?: readonly EngineType[];
}): EngineType | null {
  const {
    activeEngine,
    candidates,
    preserveDisabledActiveEngine = false,
    preferredOrder = ENABLED_ENGINE_TYPES,
  } = options;
  const disabled = toDisabledSet(options.disabledCliEngineIds);

  if (!disabled.has(activeEngine)) {
    return null;
  }
  if (preserveDisabledActiveEngine) {
    return null;
  }

  const installedByType = new Map(
    candidates.map((entry) => [entry.type, entry.installed] as const),
  );

  for (const engine of preferredOrder) {
    if (!isSupportedEngineType(engine)) {
      continue;
    }
    if (disabled.has(engine)) {
      continue;
    }
    if (!installedByType.get(engine)) {
      continue;
    }
    if (engine === activeEngine) {
      return null;
    }
    return engine;
  }

  return null;
}
