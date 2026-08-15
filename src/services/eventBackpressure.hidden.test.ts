// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBackpressure } from "./eventBackpressure";

type TestEvent = {
  id: string;
  kind: string;
};

const originalVisibilityState = document.visibilityState;

function stubVisibilityState(value: string) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

describe("eventBackpressure 窗口隐藏排水（Task 5.3）", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    stubVisibilityState(originalVisibilityState);
    vi.useRealTimers();
  });

  it("隐藏时默认排程不走 rAF，低频 timeout 持续排空 protected 队列", () => {
    stubVisibilityState("hidden");
    let rafCalled = false;
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCalled = true;
      return originalRaf(cb);
    }) as typeof window.requestAnimationFrame;
    try {
      const listener = vi.fn();
      // 不注入 schedule：走生产默认排程。
      const backpressure = createEventBackpressure<TestEvent>({
        surfaceId: "test",
        eventKind: "terminal-output",
      });
      backpressure.subscribe(listener);

      backpressure.push({ id: "1", kind: "line" });
      backpressure.push({ id: "2", kind: "line" });
      expect(listener).not.toHaveBeenCalled();

      // rAF 在隐藏时停发；若仍按 rAF 排程这里永远不会 flush（无界积压）。
      vi.advanceTimersByTime(100);
      expect(rafCalled).toBe(false);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(backpressure.queueDepth).toBe(0);

      // 持续到达的事件在隐藏期间继续被低频排空，不在队列里积压。
      backpressure.push({ id: "3", kind: "line" });
      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(backpressure.queueDepth).toBe(0);
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
  });

  it("可见时仍走 rAF 排程（jsdom visibilityState=prerender 不误伤）", () => {
    stubVisibilityState("prerender");
    let rafCalled = false;
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCalled = true;
      return originalRaf(cb);
    }) as typeof window.requestAnimationFrame;
    try {
      const listener = vi.fn();
      const backpressure = createEventBackpressure<TestEvent>({
        surfaceId: "test",
        eventKind: "terminal-output",
      });
      backpressure.subscribe(listener);

      backpressure.push({ id: "1", kind: "line" });
      expect(rafCalled).toBe(true);
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
  });
});
