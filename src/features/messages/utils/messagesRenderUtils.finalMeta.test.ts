import { describe, expect, it } from "vitest";
import {
  buildAssistantFinalBoundaryMetaText,
  formatDurationMs,
  formatTokenCount,
} from "./messagesRenderUtils";
import {
  resolveTurnTokenCountsFromUsage,
  stampLatestFinalAssistantTurnTokens,
} from "../../threads/hooks/threadReducerAssistantFinalMetadata";
import type { ConversationItem, ThreadTokenUsage } from "../../../types";

const t = (key: string, params?: Record<string, unknown>) => {
  if (key === "messages.durationSeconds") {
    return `耗时${String(params?.seconds ?? "")}s`;
  }
  if (key === "messages.tokenUsageTooltip") {
    return `输入 ${String(params?.input ?? "")} token / 输出 ${String(params?.output ?? "")} token`;
  }
  return key;
};

describe("formatTokenCount", () => {
  it("formats compact token counts", () => {
    expect(formatTokenCount(149)).toBe("149");
    expect(formatTokenCount(43_000)).toBe("43.0K");
    expect(formatTokenCount(1_200_000)).toBe("1.2M");
  });
});

describe("buildAssistantFinalBoundaryMetaText", () => {
  it("inlines completion time, duration, and token usage", () => {
    expect(
      buildAssistantFinalBoundaryMetaText({
        finalDurationMs: 13_000,
        finalInputTokens: 41_100,
        finalOutputTokens: 105,
        finalCompletedAt: new Date(2026, 6, 31, 20, 42, 26).getTime(),
        t,
      }),
    ).toBe("07-31 20:42:26 耗时13s · 输入 41.1K token / 输出 105 token");
  });

  it("keeps completion time when duration and tokens are absent", () => {
    expect(
      buildAssistantFinalBoundaryMetaText({
        finalCompletedAt: new Date(2026, 3, 1, 10, 20, 30).getTime(),
        t,
      }),
    ).toBe("04-01 10:20:30");
  });

  it("formats multi-hour clock durations", () => {
    expect(formatDurationMs(3_661_000)).toBe("1:01:01");
  });
});

describe("stampLatestFinalAssistantTurnTokens", () => {
  it("stamps last-turn usage onto the latest final assistant message", () => {
    const items: ConversationItem[] = [
      {
        id: "a1",
        kind: "message",
        role: "assistant",
        text: "old",
        isFinal: true,
        finalDurationMs: 1000,
      },
      {
        id: "a2",
        kind: "message",
        role: "assistant",
        text: "new",
        isFinal: true,
        finalDurationMs: 13_000,
      },
    ];
    const usage: ThreadTokenUsage = {
      total: {
        totalTokens: 43_149,
        inputTokens: 37,
        cachedInputTokens: 42_963,
        outputTokens: 149,
        reasoningOutputTokens: 0,
      },
      last: {
        totalTokens: 43_149,
        inputTokens: 37,
        cachedInputTokens: 42_963,
        outputTokens: 149,
        reasoningOutputTokens: 0,
      },
      modelContextWindow: null,
    };
    const counts = resolveTurnTokenCountsFromUsage(usage);
    expect(counts).toEqual({ inputTokens: 43_000, outputTokens: 149 });
    const next = stampLatestFinalAssistantTurnTokens(items, usage);
    expect(next[0]).toEqual(items[0]);
    expect(next[1]).toMatchObject({
      id: "a2",
      finalInputTokens: 43_000,
      finalOutputTokens: 149,
    });
  });
});
