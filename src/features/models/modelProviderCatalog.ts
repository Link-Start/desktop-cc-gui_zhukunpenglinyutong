import type { EngineType } from "../../types";

export type ModelCatalogSource = "runtime" | "configured" | "cached" | "fallback";
export type ModelCatalogEntry = Readonly<{
  engine: EngineType;
  provider: string;
  protocol: string;
  id: string;
  label: string;
  description: string;
  source: ModelCatalogSource;
  provenance: string;
  observedAt?: number;
  lastVerifiedAt?: string;
  lifecycle?: string;
  supportedReasoningEfforts?: readonly {
    reasoningEffort: string;
    description: string;
  }[];
  defaultReasoningEffort?: string | null;
}>;

export type ModelCatalogSnapshot = Readonly<{
  entries: readonly ModelCatalogEntry[];
  stale: boolean;
  error: string | null;
  refreshedAt: number | null;
}>;

const SOURCE_PRECEDENCE: Readonly<Record<ModelCatalogSource, number>> = {
  runtime: 4,
  configured: 3,
  cached: 2,
  fallback: 1,
};

function catalogIdentity(entry: ModelCatalogEntry): string {
  return `${entry.engine}\u0000${entry.provider}\u0000${entry.id}`;
}

export function mergeModelCatalogSources(
  sources: readonly (readonly ModelCatalogEntry[])[],
): readonly ModelCatalogEntry[] {
  const owners = new Map<string, ModelCatalogEntry>();
  const order: string[] = [];
  for (const source of sources) {
    for (const entry of source) {
      const identity = catalogIdentity(entry);
      const current = owners.get(identity);
      if (!current) {
        owners.set(identity, Object.freeze({ ...entry }));
        order.push(identity);
        continue;
      }
      if (SOURCE_PRECEDENCE[entry.source] > SOURCE_PRECEDENCE[current.source]) {
        owners.set(identity, Object.freeze({ ...current, ...entry }));
      }
    }
  }
  return Object.freeze(order.flatMap((identity) => {
    const entry = owners.get(identity);
    return entry ? [entry] : [];
  }));
}

export function createModelCatalogCache() {
  let lastGood: ModelCatalogSnapshot = Object.freeze({
    entries: Object.freeze([]),
    stale: false,
    error: null,
    refreshedAt: null,
  });
  return Object.freeze({
    commit(entries: readonly ModelCatalogEntry[], observedAt = Date.now()) {
      if (entries.length === 0) {
        throw new Error("model catalog refresh produced no validated entries");
      }
      lastGood = Object.freeze({
        entries: Object.freeze([...entries]),
        stale: false,
        error: null,
        refreshedAt: observedAt,
      });
      return lastGood;
    },
    fail(error: unknown): ModelCatalogSnapshot {
      const message = error instanceof Error ? error.message : String(error);
      return Object.freeze({
        ...lastGood,
        stale: lastGood.entries.length > 0,
        error: message,
      });
    },
    snapshot() {
      return lastGood;
    },
  });
}
