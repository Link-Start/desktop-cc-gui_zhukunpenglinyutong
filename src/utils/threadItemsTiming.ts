function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return null;
}

export function getThreadTimestamp(thread: Record<string, unknown>) {
  const raw =
    (thread.updatedAt ?? thread.updated_at ?? thread.createdAt ?? thread.created_at) ??
    0;
  let numeric: number;
  if (typeof raw === "string") {
    const asNumberValue = Number(raw);
    if (Number.isFinite(asNumberValue)) {
      numeric = asNumberValue;
    } else {
      const parsed = Date.parse(raw);
      if (!Number.isFinite(parsed)) {
        return 0;
      }
      numeric = parsed;
    }
  } else {
    numeric = Number(raw);
  }
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

export function extractAssistantFinalFlag(
  item: Record<string, unknown>,
): boolean | undefined {
  const metadata = asRecord(item.metadata);
  const candidates: unknown[] = [
    item.isFinal,
    item.is_final,
    item.final,
    item.isFinalMessage,
    item.is_final_message,
    metadata?.isFinal,
    metadata?.is_final,
    metadata?.final,
    metadata?.isFinalMessage,
    metadata?.is_final_message,
  ];
  for (const candidate of candidates) {
    const parsed = asBoolean(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return undefined;
}

export function parseTimestampLikeMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function extractFinalCompletedAtMs(
  item: Record<string, unknown>,
): number | undefined {
  const metadata = asRecord(item.metadata);
  const candidates: unknown[] = [
    item.finalCompletedAt,
    item.final_completed_at,
    item.completedAt,
    item.completed_at,
    metadata?.finalCompletedAt,
    metadata?.final_completed_at,
    metadata?.completedAt,
    metadata?.completed_at,
  ];
  for (const candidate of candidates) {
    const parsed = parseTimestampLikeMs(candidate);
    if (typeof parsed === "number") {
      return parsed;
    }
  }
  return undefined;
}

export function extractFinalDurationMs(
  item: Record<string, unknown>,
): number | undefined {
  const metadata = asRecord(item.metadata);
  const candidates: unknown[] = [
    item.finalDurationMs,
    item.final_duration_ms,
    item.durationMs,
    item.duration_ms,
    metadata?.finalDurationMs,
    metadata?.final_duration_ms,
    metadata?.durationMs,
    metadata?.duration_ms,
  ];
  for (const candidate of candidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

function readNonNegativeTokenCount(value: unknown): number | undefined {
  const parsed = asNumber(value);
  if (parsed === null || parsed < 0) {
    return undefined;
  }
  return parsed;
}

/**
 * Extract whole-turn input/output token counts stamped on an assistant message.
 * Input prefers an explicit total, otherwise sums non-cache + cache write + cache read
 * (same aggregation jetbrains MessageItem uses for the footer chip).
 */
export function extractFinalTurnTokenCounts(
  item: Record<string, unknown>,
): { inputTokens: number; outputTokens: number } | null {
  const metadata = asRecord(item.metadata);
  const usage = asRecord(
    item.turnUsage ??
      item.usage ??
      metadata?.turnUsage ??
      metadata?.usage ??
      null,
  );
  const explicitInput = readNonNegativeTokenCount(
    item.finalInputTokens ??
      item.final_input_tokens ??
      metadata?.finalInputTokens ??
      metadata?.final_input_tokens,
  );
  const explicitOutput = readNonNegativeTokenCount(
    item.finalOutputTokens ??
      item.final_output_tokens ??
      metadata?.finalOutputTokens ??
      metadata?.final_output_tokens,
  );
  if (typeof explicitInput === "number" || typeof explicitOutput === "number") {
    return {
      inputTokens: explicitInput ?? 0,
      outputTokens: explicitOutput ?? 0,
    };
  }
  if (!usage) {
    return null;
  }
  const nonCacheInput =
    readNonNegativeTokenCount(
      usage.input_tokens ?? usage.inputTokens,
    ) ?? 0;
  const cacheCreation =
    readNonNegativeTokenCount(
      usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens,
    ) ?? 0;
  const cacheRead =
    readNonNegativeTokenCount(
      usage.cache_read_input_tokens ??
        usage.cached_input_tokens ??
        usage.cachedInputTokens ??
        usage.cacheReadInputTokens,
    ) ?? 0;
  const output =
    readNonNegativeTokenCount(
      usage.output_tokens ?? usage.outputTokens,
    ) ?? 0;
  const input = nonCacheInput + cacheCreation + cacheRead;
  if (input <= 0 && output <= 0) {
    return null;
  }
  return { inputTokens: input, outputTokens: output };
}

export function extractHistoryItemTimestampMs(
  item: Record<string, unknown>,
): number | undefined {
  const metadata = asRecord(item.metadata);
  const candidates: unknown[] = [
    item.timestamp,
    item.timestamp_ms,
    item.timestampMs,
    item.createdAt,
    item.created_at,
    item.updatedAt,
    item.updated_at,
    metadata?.timestamp,
    metadata?.timestamp_ms,
    metadata?.timestampMs,
    metadata?.createdAt,
    metadata?.created_at,
    metadata?.updatedAt,
    metadata?.updated_at,
  ];
  for (const candidate of candidates) {
    const parsed = parseTimestampLikeMs(candidate);
    if (typeof parsed === "number") {
      return parsed;
    }
  }
  return undefined;
}
