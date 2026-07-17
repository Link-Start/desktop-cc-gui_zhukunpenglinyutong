import { describe, expect, it } from "vitest";
import {
  resolveGitHistoryDateRange,
  sanitizeGitHistoryDatePreset,
} from "./gitHistoryCommitFilters";

describe("gitHistoryCommitFilters", () => {
  it("sanitizes persisted date presets", () => {
    expect(sanitizeGitHistoryDatePreset("all")).toBe("all");
    expect(sanitizeGitHistoryDatePreset("today")).toBe("today");
    expect(sanitizeGitHistoryDatePreset("7d")).toBe("7d");
    expect(sanitizeGitHistoryDatePreset("30d")).toBe("30d");
    expect(sanitizeGitHistoryDatePreset("custom")).toBe("all");
    expect(sanitizeGitHistoryDatePreset(null)).toBe("all");
  });

  it("keeps all-history free of date bounds", () => {
    expect(resolveGitHistoryDateRange("all", 1_739_323_845_678)).toEqual({
      dateFrom: null,
      dateTo: null,
    });
  });

  it("resolves today from local midnight through the fixed clock", () => {
    const nowMs = new Date(2026, 6, 17, 15, 30, 45, 678).getTime();
    const localMidnightMs = new Date(2026, 6, 17, 0, 0, 0, 0).getTime();

    expect(resolveGitHistoryDateRange("today", nowMs)).toEqual({
      dateFrom: Math.floor(localMidnightMs / 1_000),
      dateTo: Math.floor(nowMs / 1_000),
    });
  });

  it.each([
    ["7d", 7],
    ["30d", 30],
  ] as const)("resolves %s as a stable rolling range", (preset, days) => {
    const nowMs = 1_752_743_845_678;
    const range = resolveGitHistoryDateRange(preset, nowMs);

    expect(range).toEqual({
      dateFrom: Math.floor((nowMs - days * 24 * 60 * 60 * 1_000) / 1_000),
      dateTo: Math.floor(nowMs / 1_000),
    });
    expect(resolveGitHistoryDateRange(preset, nowMs)).toEqual(range);
  });
});
