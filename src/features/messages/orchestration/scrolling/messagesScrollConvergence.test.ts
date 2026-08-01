// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { startConversationScrollConvergence } from "./messagesScrollConvergence";

function makeContainer() {
  const container = document.createElement("div");
  const geometry = { scrollHeight: 2_000, clientHeight: 500, scrollTop: 300, writeCount: 0 };
  Object.defineProperties(container, {
    scrollHeight: { configurable: true, get: () => geometry.scrollHeight },
    clientHeight: { configurable: true, get: () => geometry.clientHeight },
    scrollTop: {
      configurable: true,
      get: () => geometry.scrollTop,
      set: (value: number) => {
        geometry.writeCount += 1;
        geometry.scrollTop = Math.max(
          0,
          Math.min(value, geometry.scrollHeight - geometry.clientHeight),
        );
      },
    },
  });
  return { container, geometry };
}

function nextFrames(count: number) {
  return new Promise<void>((resolve) => {
    const tick = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => tick(remaining - 1));
    };
    tick(count);
  });
}

describe("messagesScrollConvergence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconverges after a post-write virtualizer correction", async () => {
    const { container, geometry } = makeContainer();
    startConversationScrollConvergence(container, { edge: "bottom", motion: "instant" });
    expect(container.scrollTop).toBe(1_500);

    // 模拟 virtualizer 在首次写底后成为最后 writer，把 viewport 修正回半路。
    geometry.scrollTop = 900;
    await nextFrames(1);
    expect(container.scrollTop).toBe(1_500);
  });

  it("tracks a bottom target that grows while smooth navigation is active", async () => {
    const { container, geometry } = makeContainer();
    startConversationScrollConvergence(container, { edge: "bottom", motion: "smooth" });
    geometry.scrollHeight = 3_000;

    await nextFrames(30);
    expect(container.scrollTop).toBe(2_500);
  });

  it("rechecks a late bottom target without a resize notification", () => {
    vi.useFakeTimers();
    const { container, geometry } = makeContainer();
    startConversationScrollConvergence(container, {
      edge: "bottom",
      motion: "instant",
      recheckDelaysMs: [100],
    });
    expect(container.scrollTop).toBe(1_500);

    geometry.scrollHeight = 3_000;
    vi.advanceTimersByTime(100);

    expect(container.scrollTop).toBe(2_500);
  });

  it("does not write scrollTop when every checkpoint is already at the edge", () => {
    vi.useFakeTimers();
    const { container, geometry } = makeContainer();
    geometry.scrollTop = 1_500;
    startConversationScrollConvergence(container, {
      edge: "bottom",
      motion: "instant",
      recheckDelaysMs: [60],
    });

    vi.advanceTimersByTime(60);

    expect(geometry.writeCount).toBe(0);
  });

  it("stops writing after cancellation", () => {
    vi.useFakeTimers();
    const { container, geometry } = makeContainer();
    const cancel = startConversationScrollConvergence(container, {
      edge: "bottom",
      motion: "instant",
      recheckDelaysMs: [80],
    });
    cancel();
    const positionAtCancellation = geometry.scrollTop;
    geometry.scrollHeight = 3_000;

    vi.advanceTimersByTime(80);
    expect(container.scrollTop).toBe(positionAtCancellation);
  });

  it("cancels pending checkpoints when the lifecycle guard is revoked", () => {
    vi.useFakeTimers();
    const { container, geometry } = makeContainer();
    const onComplete = vi.fn();
    let allowed = true;
    startConversationScrollConvergence(container, {
      edge: "bottom",
      motion: "instant",
      recheckDelaysMs: [80],
      shouldContinue: () => allowed,
      onComplete,
    });
    allowed = false;
    geometry.scrollHeight = 3_000;

    vi.advanceTimersByTime(80);

    expect(container.scrollTop).toBe(1_500);
    expect(onComplete).toHaveBeenCalledWith("cancelled");
  });

  it("finishes at the current edge when the safety budget expires", () => {
    const { container } = makeContainer();
    const onComplete = vi.fn();
    startConversationScrollConvergence(container, {
      edge: "bottom",
      motion: "smooth",
      maxDurationMs: 0,
      onComplete,
    });

    expect(container.scrollTop).toBe(1_500);
    expect(onComplete).toHaveBeenCalledWith("timeout");
  });
});
