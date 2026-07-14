// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScrollControl } from "./ScrollControl";
import { startConversationScrollConvergence } from "./messagesScrollConvergence";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

// 等待若干个动画帧，让自驱动滚动推进。
function nextFrames(count: number) {
  return new Promise<void>((resolve) => {
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function renderScrollControl(container: HTMLDivElement) {
  return render(
    <ScrollControl
      containerRef={{ current: container }}
      onRequestScrollToEdge={(edge) => {
        startConversationScrollConvergence(container, { edge, motion: "smooth" });
      }}
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

  // Regression guard：虚拟列表 / content-visibility 会在滚动途中撑高内容。
  // 一次性 scrollTo({behavior:"smooth"}) 会停在旧目标(1500)上，这正是「点了只滚一段」。
  it("keeps chasing the bottom when content grows mid-scroll (virtualized rows landing)", async () => {
    const { container, state } = makeContainer({ scrollTop: 300 });
    renderScrollControl(container);

    fireEvent.wheel(container, { deltaY: 120 });
    const button = await screen.findByTestId("messages-scroll-control");
    fireEvent.click(button);

    // 动画开跑后，模拟新虚拟行落地把内容撑高。
    await nextFrames(2);
    state.scrollHeight = 3000;

    // 必须追到新的真实底部 3000 - 500 = 2500，而不是停在 1500。
    await waitFor(() => expect(container.scrollTop).toBe(2500));
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
