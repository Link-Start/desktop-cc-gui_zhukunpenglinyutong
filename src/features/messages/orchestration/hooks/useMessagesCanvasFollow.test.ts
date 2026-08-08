// @vitest-environment jsdom
/**
 * 对齐 jetbrains-cc-gui useScrollBehavior（P0 砍分叉后）。
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMessagesCanvasFollow } from "./useMessagesCanvasFollow";

let resizeObserverCallback: ResizeObserverCallback | null = null;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

function createScrollableContainer() {
  const container = document.createElement("div");
  container.className = "messages scrollable";
  let scrollHeightValue = 1000;
  const clientHeightValue = 400;
  let scrollTopValue = 600;

  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    get: () => clientHeightValue,
  });
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    get: () => scrollHeightValue,
  });
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    get: () => scrollTopValue,
    set: (value: number) => {
      const maxScrollTop = Math.max(0, scrollHeightValue - clientHeightValue);
      scrollTopValue = Math.min(Math.max(0, value), maxScrollTop);
    },
  });

  const timeline = document.createElement("div");
  timeline.className = "messages-timeline-root";
  container.appendChild(timeline);

  return {
    container,
    getScrollTop: () => scrollTopValue,
    setScrollTop: (value: number) => {
      const maxScrollTop = Math.max(0, scrollHeightValue - clientHeightValue);
      scrollTopValue = Math.min(Math.max(0, value), maxScrollTop);
    },
    setScrollHeight: (value: number) => {
      scrollHeightValue = value;
    },
  };
}

type HookProps = {
  followSignal: string;
  isThinking: boolean;
  renderScopeKey: string;
};

describe("useMessagesCanvasFollow (jetbrains P0)", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const liveAutoFollowEnabledRef = { current: true };

  function mountFollow(initial: HookProps = {
    followSignal: "s0",
    isThinking: true,
    renderScopeKey: "scope-0",
  }) {
    liveAutoFollowEnabledRef.current = true;
    return renderHook(
      (props: HookProps) =>
        useMessagesCanvasFollow({
          followSignal: props.followSignal,
          isThinking: props.isThinking,
          liveAutoFollowEnabledRef,
          renderScopeKey: props.renderScopeKey,
          threadId: "thread-1",
        }),
      { initialProps: initial },
    );
  }

  it("enables scroll anchoring after wheel-up", () => {
    const { container } = createScrollableContainer();
    const { result, rerender } = mountFollow();

    act(() => {
      result.current.containerRef.current = container;
      rerender({
        followSignal: "s0",
        isThinking: true,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      container.dispatchEvent(new WheelEvent("wheel", { deltaY: -40 }));
    });

    expect(result.current.userPausedRef.current).toBe(true);
    expect(result.current.isUserAtBottomRef.current).toBe(false);
    expect(container.classList.contains("scroll-anchor-enabled")).toBe(true);
  });

  it("disables scroll anchoring once the user wheels back to the bottom", () => {
    const { container, setScrollTop } = createScrollableContainer();
    const { result, rerender } = mountFollow();

    act(() => {
      result.current.containerRef.current = container;
      rerender({
        followSignal: "s0",
        isThinking: true,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      container.dispatchEvent(new WheelEvent("wheel", { deltaY: -20 }));
    });
    expect(container.classList.contains("scroll-anchor-enabled")).toBe(true);

    act(() => {
      setScrollTop(600);
      container.dispatchEvent(new WheelEvent("wheel", { deltaY: 20 }));
    });

    expect(result.current.userPausedRef.current).toBe(false);
    expect(result.current.isUserAtBottomRef.current).toBe(true);
    expect(container.classList.contains("scroll-anchor-enabled")).toBe(false);
  });

  it("keeps following when content grows while armed", () => {
    const { container, getScrollTop, setScrollHeight } = createScrollableContainer();
    const end = document.createElement("div");
    container.appendChild(end);
    const { result, rerender } = mountFollow();

    act(() => {
      result.current.containerRef.current = container;
      result.current.messagesEndRef.current = end;
      rerender({
        followSignal: "s0",
        isThinking: true,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      result.current.resumeFollowAndPin();
    });
    expect(getScrollTop()).toBe(600);

    act(() => {
      setScrollHeight(1400);
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(result.current.userPausedRef.current).toBe(false);
    expect(result.current.isUserAtBottomRef.current).toBe(true);
    expect(getScrollTop()).toBe(1000);
  });

  it("forces pin on resume even when previously paused mid-list", () => {
    const { container, getScrollTop, setScrollTop } = createScrollableContainer();
    const { result, rerender } = mountFollow({
      followSignal: "s0",
      isThinking: false,
      renderScopeKey: "scope-0",
    });

    act(() => {
      result.current.containerRef.current = container;
      rerender({
        followSignal: "s0",
        isThinking: false,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      container.dispatchEvent(new WheelEvent("wheel", { deltaY: -40 }));
      setScrollTop(100);
    });
    expect(result.current.userPausedRef.current).toBe(true);

    act(() => {
      result.current.resumeFollowAndPin();
    });

    expect(result.current.userPausedRef.current).toBe(false);
    expect(result.current.isUserAtBottomRef.current).toBe(true);
    expect(getScrollTop()).toBe(600);
  });

  it("releases follow when scroll lands far from bottom (jetbrains pure distance)", () => {
    const { container, getScrollTop, setScrollTop } = createScrollableContainer();
    const { result, rerender } = mountFollow();

    act(() => {
      result.current.containerRef.current = container;
      rerender({
        followSignal: "s0",
        isThinking: true,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      result.current.resumeFollowAndPin();
    });
    expect(getScrollTop()).toBe(600);

    act(() => {
      setScrollTop(100);
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isUserAtBottomRef.current).toBe(false);
  });

  it("settleFollow forces pin when not wheel-paused", () => {
    const { container, getScrollTop, setScrollTop } = createScrollableContainer();
    const { result, rerender } = mountFollow();

    act(() => {
      result.current.containerRef.current = container;
      rerender({
        followSignal: "s0",
        isThinking: true,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      result.current.resumeFollowAndPin();
      setScrollTop(100);
      result.current.isUserAtBottomRef.current = false;
    });

    act(() => {
      result.current.settleFollow();
    });

    expect(result.current.userPausedRef.current).toBe(false);
    expect(result.current.isUserAtBottomRef.current).toBe(true);
    expect(getScrollTop()).toBe(600);
  });

  it("settleFollow respects wheel pause", () => {
    const { container, getScrollTop, setScrollTop } = createScrollableContainer();
    const { result, rerender } = mountFollow();

    act(() => {
      result.current.containerRef.current = container;
      rerender({
        followSignal: "s0",
        isThinking: true,
        renderScopeKey: "scope-1",
      });
    });

    act(() => {
      container.dispatchEvent(new WheelEvent("wheel", { deltaY: -40 }));
      setScrollTop(100);
    });

    act(() => {
      result.current.settleFollow();
    });

    expect(result.current.userPausedRef.current).toBe(true);
    expect(getScrollTop()).toBe(100);
  });

  it("scope switch re-arms at bottom without userPaused", () => {
    const { result, rerender } = mountFollow({
      followSignal: "s0",
      isThinking: false,
      renderScopeKey: "scope-a",
    });
    expect(result.current.isUserAtBottomRef.current).toBe(true);
    act(() => {
      result.current.pauseFollow();
    });
    expect(result.current.isUserAtBottomRef.current).toBe(false);
    act(() => {
      rerender({
        followSignal: "s0",
        isThinking: false,
        renderScopeKey: "scope-b",
      });
    });
    expect(result.current.userPausedRef.current).toBe(false);
    expect(result.current.isUserAtBottomRef.current).toBe(true);
  });
});
