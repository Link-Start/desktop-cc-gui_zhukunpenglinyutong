/**
 * Model mapping constants and storage keys
 * Supports custom model name mapping similar to Claude CLI environment variables:
 * - ANTHROPIC_MODEL
 * - ANTHROPIC_DEFAULT_FABLE_MODEL
 * - ANTHROPIC_DEFAULT_HAIKU_MODEL
 * - ANTHROPIC_DEFAULT_OPUS_MODEL
 * - ANTHROPIC_DEFAULT_SONNET_MODEL
 */

/**
 * Model mapping configuration stored in localStorage
 * Maps base model IDs to custom model names (e.g., for GLM or other providers)
 */
export interface ModelMapping {
  /** Optional main model override (ANTHROPIC_MODEL) */
  main?: string;
  /** Custom model ID for Fable (e.g., "kimi-k3") */
  fable?: string;
  /** Custom model ID for Haiku (e.g., "glm-4.7-air") */
  haiku?: string;
  /** Custom model ID for Sonnet (e.g., "glm-4.7") */
  sonnet?: string;
  /** Custom model ID for Opus (e.g., "glm-4.7") */
  opus?: string;
}

/**
 * localStorage keys for model-related data
 */
export const STORAGE_KEYS = {
  /** Storage key for Claude model name mapping */
  CLAUDE_MODEL_MAPPING: "claude-model-mapping",
} as const;

const LEGACY_CLAUDE_MODEL_MAPPING_KEYS = [
  "mossx-claude-model-mapping",
  "codemoss-claude-model-mapping",
] as const;

/**
 * Mapping from model ID to mapping key
 * Used to apply custom display names to models
 */
export const MODEL_ID_TO_MAPPING_KEY: Record<string, keyof ModelMapping> = {
  fable: "fable",
  sonnet: "sonnet",
  opus: "opus",
  haiku: "haiku",
  "claude-fable-5": "fable",
  "claude-sonnet-5": "sonnet",
  "claude-sonnet-4-7": "sonnet",
  "claude-sonnet-4-6": "sonnet",
  "claude-sonnet-4-5-20250929": "sonnet",
  "claude-opus-5": "opus",
  "claude-opus-4-8": "opus",
  "claude-opus-4-6": "opus",
  "claude-opus-4-6[1m]": "opus",
  "claude-opus-4-5-20251101": "opus",
  "claude-haiku-4-5": "haiku",
  "claude-haiku-4-5-20251001": "haiku",
  "settings-fable": "fable",
  "settings-sonnet": "sonnet",
  "settings-opus": "opus",
  "settings-haiku": "haiku",
  "settings-main": "main",
};

function inferModelFamilyKey(modelId: string): keyof ModelMapping | undefined {
  const normalized = modelId.toLowerCase();
  if (normalized.includes("fable")) {
    return "fable";
  }
  if (normalized.includes("haiku")) {
    return "haiku";
  }
  if (normalized.includes("sonnet")) {
    return "sonnet";
  }
  if (normalized.includes("opus")) {
    return "opus";
  }
  if (normalized === "settings-main" || normalized === "main") {
    return "main";
  }
  return undefined;
}

function getMappingKeyForModel(modelId: string): keyof ModelMapping | undefined {
  return MODEL_ID_TO_MAPPING_KEY[modelId] ?? inferModelFamilyKey(modelId);
}

/**
 * Resolve the mapped runtime model name for a catalog entry.
 * Falls back to `main` when a tier-specific slot is empty (mirrors jetbrains).
 */
export function resolveModelMappingValue(
  modelId: string,
  mapping: ModelMapping,
): string | null {
  const key = getMappingKeyForModel(modelId);
  const candidates = [
    key ? mapping[key] : undefined,
    // settings-main / unknown claude ids still fall back to main
    key !== "main" ? mapping.main : undefined,
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Get model mapping from localStorage
 */
export type ModelMappingStorageResult = Readonly<{
  mapping: ModelMapping;
  warnings: readonly string[];
}>;

function parseStoredModelMapping(stored: string): ModelMapping {
  const parsed = JSON.parse(stored);
  const mapping: ModelMapping = {};
  if (typeof parsed.main === "string" && parsed.main.trim()) {
    mapping.main = parsed.main.trim();
  }
  if (typeof parsed.fable === "string" && parsed.fable.trim()) {
    mapping.fable = parsed.fable.trim();
  }
  if (typeof parsed.haiku === "string" && parsed.haiku.trim()) {
    mapping.haiku = parsed.haiku.trim();
  }
  if (typeof parsed.sonnet === "string" && parsed.sonnet.trim()) {
    mapping.sonnet = parsed.sonnet.trim();
  }
  if (typeof parsed.opus === "string" && parsed.opus.trim()) {
    mapping.opus = parsed.opus.trim();
  }
  return mapping;
}

function hasMappingValue(mapping: ModelMapping): boolean {
  return Object.values(mapping).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

export function migrateModelMappingStorage(): ModelMappingStorageResult {
  if (typeof window === "undefined" || !window.localStorage) {
    return Object.freeze({ mapping: {}, warnings: ["localStorage unavailable"] });
  }
  const warnings: string[] = [];
  const candidateKeys = [
    STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
    ...LEGACY_CLAUDE_MODEL_MAPPING_KEYS,
  ];
  for (const key of candidateKeys) {
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) {
        continue;
      }
      const mapping = parseStoredModelMapping(stored);
      if (Object.keys(mapping).length > 0 || key === STORAGE_KEYS.CLAUDE_MODEL_MAPPING) {
        if (key !== STORAGE_KEYS.CLAUDE_MODEL_MAPPING) {
          window.localStorage.setItem(
            STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
            JSON.stringify(mapping),
          );
        }
        for (const legacyKey of LEGACY_CLAUDE_MODEL_MAPPING_KEYS) {
          try {
            window.localStorage.removeItem(legacyKey);
          } catch (error) {
            warnings.push(
              `Failed to remove legacy Claude model mapping ${legacyKey}: ${String(error)}`,
            );
          }
        }
        return Object.freeze({
          mapping,
          warnings: Object.freeze(warnings),
        });
      }
    } catch (error) {
      warnings.push(`Failed to migrate Claude model mapping ${key}: ${String(error)}`);
      continue;
    }
  }
  return Object.freeze({ mapping: {}, warnings: Object.freeze(warnings) });
}

export function getModelMapping(): ModelMapping {
  return migrateModelMappingStorage().mapping;
}

/**
 * Save model mapping to localStorage and notify same-tab listeners.
 */
export function saveModelMapping(
  mapping: ModelMapping,
): Readonly<{ ok: true; warnings: readonly string[] } | { ok: false; error: string }> {
  if (typeof window === "undefined" || !window.localStorage) {
    return Object.freeze({ ok: false, error: "localStorage unavailable" });
  }
  try {
    const warnings: string[] = [];
    const filtered: ModelMapping = {};
    if (mapping.main?.trim()) filtered.main = mapping.main.trim();
    if (mapping.fable?.trim()) filtered.fable = mapping.fable.trim();
    if (mapping.haiku?.trim()) filtered.haiku = mapping.haiku.trim();
    if (mapping.sonnet?.trim()) filtered.sonnet = mapping.sonnet.trim();
    if (mapping.opus?.trim()) filtered.opus = mapping.opus.trim();

    if (hasMappingValue(filtered)) {
      window.localStorage.setItem(
        STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
        JSON.stringify(filtered),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.CLAUDE_MODEL_MAPPING);
    }

    for (const legacyKey of LEGACY_CLAUDE_MODEL_MAPPING_KEYS) {
      try {
        window.localStorage.removeItem(legacyKey);
      } catch (error) {
        warnings.push(
          `Failed to remove legacy Claude model mapping ${legacyKey}: ${String(error)}`,
        );
      }
    }

    // Same-tab writes do not fire the native storage event.
    window.dispatchEvent(
      new CustomEvent("localStorageChange", {
        detail: { key: STORAGE_KEYS.CLAUDE_MODEL_MAPPING },
      }),
    );

    return Object.freeze({ ok: true, warnings: Object.freeze(warnings) });
  } catch (error) {
    return Object.freeze({ ok: false, error: String(error) });
  }
}

/**
 * Build a ModelMapping from Claude provider env vars
 * (ANTHROPIC_DEFAULT_* / ANTHROPIC_MODEL).
 */
export function buildModelMappingFromEnv(
  env: Record<string, unknown> | null | undefined,
): ModelMapping {
  if (!env || typeof env !== "object") {
    return {};
  }
  const read = (key: string): string | undefined => {
    const value = env[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const mapping: ModelMapping = {};
  const main = read("ANTHROPIC_MODEL");
  const fable = read("ANTHROPIC_DEFAULT_FABLE_MODEL");
  const haiku = read("ANTHROPIC_DEFAULT_HAIKU_MODEL");
  const sonnet = read("ANTHROPIC_DEFAULT_SONNET_MODEL");
  const opus = read("ANTHROPIC_DEFAULT_OPUS_MODEL");
  if (main) mapping.main = main;
  if (fable) mapping.fable = fable;
  if (haiku) mapping.haiku = haiku;
  if (sonnet) mapping.sonnet = sonnet;
  if (opus) mapping.opus = opus;
  return mapping;
}

/**
 * Persist mapping derived from the active provider's env.
 * Clears the stored mapping when env has no model slots.
 */
export function syncModelMappingFromProviderEnv(
  env: Record<string, unknown> | null | undefined,
): Readonly<{ ok: true; warnings: readonly string[] } | { ok: false; error: string }> {
  return saveModelMapping(buildModelMappingFromEnv(env));
}

/**
 * Apply model mapping to a display name
 * @param baseDisplayName - The original display name
 * @param modelId - The model ID to look up in the mapping
 * @param mapping - The model mapping configuration
 * @returns The mapped display name, or the original if no mapping exists
 */
export function applyModelMapping(
  baseDisplayName: string,
  modelId: string,
  mapping: ModelMapping,
): string {
  return resolveModelMappingValue(modelId, mapping) ?? baseDisplayName;
}
