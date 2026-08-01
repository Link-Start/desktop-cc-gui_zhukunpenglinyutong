// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMarkdownStreamingValue } from "./useMarkdownStreamingValue";

describe("useMarkdownStreamingValue", () => {
  it("throttles rapid value changes until the timer flushes", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useMarkdownStreamingValue>[0]) =>
          useMarkdownStreamingValue(props),
        {
          initialProps: {
            value: "draft",
            streamingThrottleMs: 120,
            progressiveReveal: false,
            progressiveRevealStepMs: 28,
            progressiveRevealChunkChars: 360,
          },
        },
      );

      expect(result.current.renderValue).toBe("draft");

      rerender({
        value: "draft update",
        streamingThrottleMs: 120,
        progressiveReveal: false,
        progressiveRevealStepMs: 28,
        progressiveRevealChunkChars: 360,
      });

      expect(result.current.renderValue).toBe("draft");

      act(() => {
        vi.advanceTimersByTime(120);
      });

      expect(result.current.renderValue).toBe("draft update");
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes immediately when the throttle window changes", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useMarkdownStreamingValue>[0]) =>
          useMarkdownStreamingValue(props),
        {
          initialProps: {
            value: "draft",
            streamingThrottleMs: 120,
            progressiveReveal: false,
            progressiveRevealStepMs: 28,
            progressiveRevealChunkChars: 360,
          },
        },
      );

      rerender({
        value: "draft update",
        streamingThrottleMs: 120,
        progressiveReveal: false,
        progressiveRevealStepMs: 28,
        progressiveRevealChunkChars: 360,
      });
      expect(result.current.renderValue).toBe("draft");

      rerender({
        value: "final answer",
        streamingThrottleMs: 80,
        progressiveReveal: false,
        progressiveRevealStepMs: 28,
        progressiveRevealChunkChars: 360,
      });

      expect(result.current.renderValue).toBe("final answer");
    } finally {
      vi.useRealTimers();
    }
  });

  it("progressively reveals long markdown tails instead of flushing them at once", () => {
    vi.useFakeTimers();
    try {
      const targetValue = [
        "## 第一段",
        "",
        "第一段内容 ".repeat(40),
        "",
        "## 第二段",
        "",
        "第二段内容 ".repeat(120),
      ].join("\n");
      const { result } = renderHook(() =>
        useMarkdownStreamingValue({
          value: targetValue,
          streamingThrottleMs: 0,
          progressiveReveal: true,
          progressiveRevealStepMs: 28,
          progressiveRevealChunkChars: 120,
        }),
      );

      expect(result.current.renderValue.length).toBeGreaterThan(0);
      expect(result.current.renderValue.length).toBeLessThan(targetValue.length);

      act(() => {
        vi.advanceTimersByTime(28);
      });

      expect(result.current.renderValue.length).toBeGreaterThan(120);
      expect(result.current.renderValue.length).toBeLessThanOrEqual(targetValue.length);
    } finally {
      vi.useRealTimers();
    }
  });
});
