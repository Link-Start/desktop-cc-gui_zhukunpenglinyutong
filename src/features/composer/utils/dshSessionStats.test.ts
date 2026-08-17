import { describe, expect, it } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import {
  deriveDshSessionStatsLine,
  formatDshDuration,
  formatDshTokensPerSecond,
} from "./dshSessionStats";

function usage(
  overrides: Partial<ThreadTokenUsage> & {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    cacheWriteInputTokens?: number | null;
  } = {},
): ThreadTokenUsage {
  const inputTokens = overrides.inputTokens ?? 0;
  const cachedInputTokens = overrides.cachedInputTokens ?? 0;
  const outputTokens = overrides.outputTokens ?? 0;
  const breakdown = {
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens: 0,
  };
  return {
    total: breakdown,
    last: breakdown,
    modelContextWindow: null,
    sessionStats: overrides.sessionStats,
    cacheWriteInputTokens: overrides.cacheWriteInputTokens,
  };
}

describe("dshSessionStats", () => {
  it("formats duration and throughput like DSH StatsLine", () => {
    expect(formatDshDuration(8_500)).toBe("8.5s");
    expect(formatDshDuration(72_000)).toBe("1m12s");
    expect(formatDshTokensPerSecond(72.4)).toBe("72");
    expect(formatDshTokensPerSecond(8.25)).toBe("8.3");
  });

  it("builds the red-box model from sessionStats plus cache hit", () => {
    expect(
      deriveDshSessionStatsLine(
        usage({
          inputTokens: 4,
          cachedInputTokens: 96,
          sessionStats: {
            turns: 1,
            steps: 1,
            llmMs: 9_500,
            toolMs: 0,
            ttftMs: 8_500,
            ttftSteps: 1,
            decodeMs: 1_000,
            decodeTokens: 72,
          },
        }),
      ),
    ).toEqual({
      ttftAverage: "8.5s",
      tokensPerSecond: "72",
      cacheHitPercent: 96,
    });
  });

  it("includes cacheWrite in the billed-input cache-hit denominator", () => {
    expect(
      deriveDshSessionStatsLine(
        usage({
          inputTokens: 4,
          cachedInputTokens: 80,
          cacheWriteInputTokens: 16,
        }),
      ),
    ).toEqual({
      ttftAverage: null,
      tokensPerSecond: null,
      cacheHitPercent: 80,
    });
  });

  it("omits missing groups and returns null when nothing is displayable", () => {
    expect(deriveDshSessionStatsLine(usage())).toBeNull();
    expect(
      deriveDshSessionStatsLine(
        usage({
          sessionStats: {
            turns: 1,
            steps: 1,
            llmMs: 100,
            toolMs: 0,
            ttftMs: 0,
            ttftSteps: 0,
            decodeMs: 0,
            decodeTokens: 0,
          },
        }),
      ),
    ).toBeNull();
  });
});
