import type { DshSessionStats, ThreadTokenUsage } from "../../../types";

export type DshSessionStatsLineModel = {
  ttftAverage: string | null;
  tokensPerSecond: string | null;
  cacheHitPercent: number | null;
};

export function formatDshDuration(ms: number): string {
  const seconds = Math.max(0, ms) / 1_000;
  if (seconds < 60) {
    return `${Math.round(seconds * 10) / 10}s`;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m${whole % 60}s`;
}

export function formatDshTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps);
  return clamped >= 10
    ? String(Math.round(clamped))
    : String(Math.round(clamped * 10) / 10);
}

export function billedDshInputTokens(usage: ThreadTokenUsage): number {
  const uncached = Math.max(0, usage.total.inputTokens);
  const cacheRead = Math.max(0, usage.total.cachedInputTokens);
  const cacheWrite = Math.max(0, usage.cacheWriteInputTokens ?? 0);
  return uncached + cacheRead + cacheWrite;
}

export function dshCacheHitPercent(usage: ThreadTokenUsage): number | null {
  const billed = billedDshInputTokens(usage);
  if (billed <= 0) {
    return null;
  }
  return Math.round((Math.max(0, usage.total.cachedInputTokens) / billed) * 100);
}

export function deriveDshSessionStatsLine(
  usage: ThreadTokenUsage | null | undefined,
): DshSessionStatsLineModel | null {
  if (!usage) {
    return null;
  }
  const stats = usage.sessionStats ?? null;
  const ttftAverage = formatDshTtftAverage(stats);
  const tokensPerSecond = formatDshDecodeThroughput(stats);
  const cacheHitPercent = dshCacheHitPercent(usage);
  if (!ttftAverage && !tokensPerSecond && cacheHitPercent === null) {
    return null;
  }
  return { ttftAverage, tokensPerSecond, cacheHitPercent };
}

function formatDshTtftAverage(stats: DshSessionStats | null): string | null {
  if (!stats || stats.ttftSteps <= 0) {
    return null;
  }
  return formatDshDuration(stats.ttftMs / stats.ttftSteps);
}

function formatDshDecodeThroughput(stats: DshSessionStats | null): string | null {
  if (!stats || stats.decodeMs <= 0) {
    return null;
  }
  return formatDshTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000));
}
