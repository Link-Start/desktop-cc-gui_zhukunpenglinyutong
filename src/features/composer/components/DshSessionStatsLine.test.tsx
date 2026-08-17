/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import { DshSessionStatsLine } from "./DshSessionStatsLine";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "composer.dshStatsTtftAverage") {
        return `首 token 平均 ${String(options?.duration ?? "")}`;
      }
      if (key === "composer.dshStatsTokensPerSecond") {
        return `${String(options?.throughput ?? "")} tok/s`;
      }
      if (key === "composer.dshStatsCacheHit") {
        return `缓存命中 ${String(options?.percent ?? "")}%`;
      }
      return key;
    },
  }),
}));

afterEach(() => {
  cleanup();
});

function usage(): ThreadTokenUsage {
  const breakdown = {
    totalTokens: 100,
    inputTokens: 4,
    cachedInputTokens: 96,
    outputTokens: 20,
    reasoningOutputTokens: 0,
  };
  return {
    total: breakdown,
    last: breakdown,
    modelContextWindow: null,
    sessionStats: {
      turns: 1,
      steps: 1,
      llmMs: 9500,
      toolMs: 0,
      ttftMs: 8500,
      ttftSteps: 1,
      decodeMs: 1000,
      decodeTokens: 72,
    },
  };
}

describe("DshSessionStatsLine", () => {
  it("renders the red-box speed and cache groups", () => {
    render(<DshSessionStatsLine usage={usage()} />);
    expect(
      screen.getByLabelText("首 token 平均 8.5s · 72 tok/s | 缓存命中 96%"),
    ).toBeTruthy();
  });

  it("returns nothing when no DSH stats are displayable", () => {
    const { container } = render(<DshSessionStatsLine usage={null} />);
    expect(container.firstChild).toBeNull();
  });
});
