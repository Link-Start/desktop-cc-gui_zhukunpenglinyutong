import type { SharedSessionSupportedEngine } from "../utils/sharedSessionEngines";
import type { EngineType, ThreadSummary } from "../../../types";
import {
  isSharedSessionSupportedEngine,
  normalizeSharedSessionEngine,
} from "../utils/sharedSessionEngines";

const UNSUPPORTED_SHARED_ENGINE_PREFIXES = [
  "gemini:",
  "gemini-pending-",
] as const;

/** Shared-supported engines whose native list ids use `engine:{raw}` form. */
const SHARED_HIDE_ENGINE_PREFIXES = [
  "claude",
  "codex",
  "kimi",
  "grok",
  "opencode",
] as const;

type SharedSessionSummary = {
  id: string;
  threadId: string;
  title: string;
  updatedAt: number;
  selectedEngine: SharedSessionSupportedEngine;
  nativeThreadIds: string[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function shouldKeepSharedNativeThreadId(value: unknown) {
  const threadId = asString(value).trim();
  if (!threadId) {
    return false;
  }
  const normalized = threadId.toLowerCase();
  return !UNSUPPORTED_SHARED_ENGINE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

export function normalizeSharedSessionSummary(value: unknown): SharedSessionSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const threadId = asString(record.threadId ?? record.thread_id).trim();
  if (!threadId || !threadId.startsWith("shared:")) {
    return null;
  }
  const selectedEngine = asString(record.selectedEngine ?? record.selected_engine)
    .trim()
    .toLowerCase();
  const selectedEngineCandidate = selectedEngine as EngineType;
  const normalizedSelectedEngine = normalizeSharedSessionEngine(
    isSharedSessionSupportedEngine(selectedEngineCandidate)
      ? selectedEngineCandidate
      : undefined,
  );
  return {
    id: asString(record.id).trim() || threadId,
    threadId,
    title: asString(record.title).trim() || "Shared Session",
    updatedAt: Math.max(0, asNumber(record.updatedAt ?? record.updated_at)),
    selectedEngine: normalizedSelectedEngine,
    nativeThreadIds: Array.isArray(record.nativeThreadIds ?? record.native_thread_ids)
      ? ((record.nativeThreadIds ?? record.native_thread_ids) as unknown[])
          .map((entry: unknown) => asString(entry).trim())
          .filter(shouldKeepSharedNativeThreadId)
      : [],
  };
}

export function normalizeSharedSessionSummaries(value: unknown): SharedSessionSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const summaries: SharedSessionSummary[] = [];
  value.forEach((entry) => {
    const summary = normalizeSharedSessionSummary(entry);
    if (summary) {
      summaries.push(summary);
    }
  });
  return summaries;
}

/**
 * Expand Shared Hidden Binding ids so hide filters match both raw and
 * `engine:{raw}` forms (catalog uses prefixes; some bindings historically
 * stored raw session ids).
 */
export function expandHiddenSharedBindingIds(
  nativeThreadIds: Iterable<string>,
): Set<string> {
  const expanded = new Set<string>();
  for (const raw of nativeThreadIds) {
    const id = asString(raw).trim();
    if (!id) {
      continue;
    }
    expanded.add(id);
    const lower = id.toLowerCase();
    for (const engine of SHARED_HIDE_ENGINE_PREFIXES) {
      const prefix = `${engine}:`;
      if (lower.startsWith(prefix)) {
        const stripped = id.slice(prefix.length).trim();
        if (stripped) {
          expanded.add(stripped);
        }
      } else if (
        !id.includes(":") ||
        lower.startsWith(`${engine}-pending-`) ||
        lower.startsWith(`${engine}-pending-shared-`)
      ) {
        // raw / pending placeholder → also match catalog form
        expanded.add(`${engine}:${id}`);
      }
    }
  }
  return expanded;
}

export function toSharedThreadSummary(summary: SharedSessionSummary): ThreadSummary {
  return {
    id: summary.threadId,
    name: summary.title,
    updatedAt: summary.updatedAt,
    engineSource: summary.selectedEngine,
    threadKind: "shared",
    selectedEngine: summary.selectedEngine,
    nativeThreadIds: summary.nativeThreadIds,
  };
}
