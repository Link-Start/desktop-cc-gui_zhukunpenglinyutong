// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScrollControl } from "./ScrollControl";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

/** 与 MessagesCore handleScrollControlRequest 同契约：瞬时落位（追底职责在 follow hook）。 */
function applyScrollEdge(container: HTMLDivElement, edge: "top" | "bottom") {
  container.scrollTop = edge === "bottom" ? container.scrollHeight : 0;
}

/**
 * 构造一个可控滚动几何的容器（jsdom 默认 scrollHeight/clientHeight 均为 0）。
 * scrollHeight 通过 state 暴露为可变值，用来模拟虚拟列表 / content-visibility
 * 在滚动途中把内容撑高的真实行为。scrollTop 的 setter 按浏览器语义做 clamp。
 */
function makeContainer({
  scrollHeight = 2000,
  clientHeight = 500,
  scrollTop = 300,
}: {
  scrollHeight?: number;
  clientHeight?: number;
  scrollTop?: number;
} = {}) {
  const container = document.createElement("div");
  const state = { scrollHeight };
  let top = scrollTop;

  Object.defineProperty(container, "scrollHeight", {
    get: () => state.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(container, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
  Object.defineProperty(container, "scrollTop", {
    get: () => top,
    set: (next: number) => {
      top = Math.max(0, Math.min(next, state.scrollHeight - clientHeight));
    },
    configurable: true,
  });

  return { container, state };
}

function renderScrollControl(container: HTMLDivElement) {
  return render(
    <ScrollControl
      containerRef={{ current: container }}
      onRequestScrollToEdge={(edge) => applyScrollEdge(container, edge)}
    />,
  );
}

describe("ScrollControl", () => {
  it("stays hidden until the user scrolls", () => {
    const { container } = makeContainer();
    renderScrollControl(container);
    expect(screen.queryByTestId("messages-scroll-control")).toBeNull();
  });

  it("shows a back-to-bottom control on downward scroll and scrolls to the bottom on click", async () => {
    const { container } = makeContainer({ scrollTop: 300 });
    renderScrollControl(container);

    fireEvent.wheel(container, { deltaY: 120 });

    const button = await screen.findByTestId("messages-scroll-control");
    expect(button.getAttribute("aria-label")).toBe("messages.backToBottom");

    fireEvent.click(button);
    // 2000 - 500 = 1500
    await waitFor(() => expect(container.scrollTop).toBe(1500));
  });

  it("shows a back-to-top control on upward scroll and scrolls to the top on click", async () => {
    const { container } = makeContainer({ scrollTop: 300 });
    renderScrollControl(container);

    fireEvent.wheel(container, { deltaY: -120 });

    const button = await screen.findByTestId("messages-scroll-control");
    expect(button.getAttribute("aria-label")).toBe("messages.backToTop");

    fireEvent.click(button);
    await waitFor(() => expect(container.scrollTop).toBe(0));
  });

  // 新契约：ScrollControl 只上报 edge，落位是 owner 的瞬时写（content-visibility 已移除，
  // 中途撑高由 follow hook 的 ResizeObserver 追底，不再依赖 smooth 动画追赶）。
  it("jumps straight to the current bottom on click", async () => {
    const { container } = makeContainer({ scrollTop: 300 });
    renderScrollControl(container);

    fireEvent.wheel(container, { deltaY: 120 });
    const button = await screen.findByTestId("messages-scroll-control");
    fireEvent.click(button);

    // 2000 - 500 = 1500
    await waitFor(() => expect(container.scrollTop).toBe(1500));
  });

  it("stays hidden when already near the bottom, even on a downward scroll", async () => {
    // distanceFromBottom = 2000 - 1500 - 500 = 0 < THRESHOLD(100)
    const { container } = makeContainer({ scrollTop: 1500 });
    renderScrollControl(container);

    fireEvent.wheel(container, { deltaY: 120 });

    await waitFor(() =>
      expect(screen.queryByTestId("messages-scroll-control")).toBeNull(),
    );
  });

  it("reports the existing edge direction to the shared scroll owner", async () => {
    const { container } = makeContainer({ scrollTop: 300 });
    const onRequestScrollToEdge = vi.fn();
    render(
      <ScrollControl
        containerRef={{ current: container }}
        onRequestScrollToEdge={onRequestScrollToEdge}
      />,
    );

    fireEvent.wheel(container, { deltaY: -10 });
    fireEvent.click(await screen.findByTestId("messages-scroll-control"));
    expect(onRequestScrollToEdge).toHaveBeenCalledWith("top");
  });
});
