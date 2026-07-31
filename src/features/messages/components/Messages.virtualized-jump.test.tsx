// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";

const scrollToIndexMock = vi.hoisted(() => vi.fn());
const measureElementMock = vi.hoisted(() => vi.fn());
const measureMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: {
    count: number;
    enabled: boolean;
    estimateSize: (index: number) => number;
    getItemKey: (index: number) => string;
  }) => {
    const visibleCount = options.enabled ? Math.min(20, options.count) : 0;
    return {
      getVirtualItems: () =>
        Array.from({ length: visibleCount }, (_, index) => ({
          index,
          key: options.getItemKey(index),
          size: options.estimateSize(index),
          start: index * options.estimateSize(index),
        })),
      getTotalSize: () =>
        Array.from({ length: options.count }, (_, index) => options.estimateSize(index))
          .reduce((total, size) => total + size, 0),
      measure: measureMock,
      measureElement: measureElementMock,
      resizeItem: vi.fn(),
      scrollToIndex: scrollToIndexMock,
    };
  },
}));

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

import { Messages } from "./Messages";
describe("Messages virtualized jump behavior", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  beforeEach(() => {
    scrollToIndexMock.mockClear();
    measureElementMock.mockClear();
    measureMock.mockClear();
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.removeItem("ccgui.messages.live.collapseMiddleSteps");
  });

  afterEach(() => {
    cleanup();
  });

  it("virtualizes large idle histories and jumps through virtualizer index", async () => {
    const items: ConversationItem[] = Array.from({ length: 220 }, (_, index) => ({
      id: `u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump-virtualized"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(
      container.querySelector(".messages-full")?.getAttribute("data-timeline-virtualized"),
    ).toBe("true");
    expect(container.querySelector(".messages-virtualized-canvas")).toBeTruthy();

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "u180",
        }),
      );
    });

    await waitFor(() => {
      expect(scrollToIndexMock).toHaveBeenCalled();
    });
  });

  it("virtualizes dense heavy histories by render weight", async () => {
    const heavyMarkdown = [
      "# Heavy section",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 28 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 24 }, (_, index) => `const value${index} = ${index};`),
      "```",
      "<tool_call><invoke name=\"read_file\" /></tool_call>",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 36 }, (_, index) => ({
      id: `heavy-u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `${heavyMarkdown}\n\n${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-heavy-jump"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(
      container.querySelector(".messages-full")?.getAttribute("data-timeline-virtualized"),
    ).toBe("true");
    expect(container.querySelector(".messages-virtualized-canvas")).toBeTruthy();

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "heavy-u30",
        }),
      );
    });

    await waitFor(() => {
      expect(scrollToIndexMock).toHaveBeenCalled();
    });
  });

  it("keeps short light conversations static with full detail", () => {
    // Under row-count floor and without dense markdown weight → static full-detail path.
    const items: ConversationItem[] = Array.from({ length: 8 }, (_, index) => ({
      id: `assistant-light-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `canonical assistant payload ${index + 1}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-static-short"
        workspaceId="ws-short"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".messages-virtualized-canvas")).toBeNull();
    expect(
      container.querySelector(".messages-full")?.getAttribute("data-timeline-virtualized"),
    ).toBe("false");
    expect(screen.getByText(/canonical assistant payload 8/)).toBeTruthy();
  });

  // A2:VISIBLE_MESSAGE_WINDOW=10000(95bc726a)有意禁用数量折叠,collapsed-indicator/折叠行为当前不启用;恢复折叠策略后去 skip。
  it.skip("uses static expanded history flow even when lightweight mode is not active", async () => {
    const items: ConversationItem[] = Array.from({ length: 240 }, (_, index) => ({
      id: `history-static-expand-${index + 1}`,
      kind: "message" as const,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      text: `plain expanded history message ${index + 1}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-expand-history-static"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const showEarlierButton = container.querySelector<HTMLButtonElement>(
      ".messages-collapsed-indicator",
    );
    expect(showEarlierButton).toBeTruthy();

    fireEvent.click(showEarlierButton!);

    await waitFor(() => {
      expect(
        container
          .querySelector(".messages-timeline-root")
          ?.getAttribute("data-timeline-static-expanded-history"),
      ).toBe("true");
    });
    expect(container.querySelector(".messages-virtualized-canvas")).toBeNull();
    expect(container.querySelector(".messages-full .messages-lightweight-mode-banner")).toBeTruthy();
    expect(container.querySelector(".messages-lightweight-row-summary")).toBeNull();
    expect(screen.getByText("plain expanded history message 1")).toBeTruthy();
  });

  // A2:VISIBLE_MESSAGE_WINDOW=10000(95bc726a)有意禁用数量折叠,collapsed 演进/scope 切换当前不启用;恢复折叠策略后去 skip。
  it.skip("changes presentation scope when a collapsed history window is manually expanded", async () => {
    const items: ConversationItem[] = Array.from({ length: 80 }, (_, index) => ({
      id: `presentation-history-${index + 1}`,
      kind: "message" as const,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      text: `presentation history message ${index + 1}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-presentation-scope"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const timelineRoot = container.querySelector(".messages-timeline-root");
    expect(timelineRoot?.getAttribute("data-timeline-presentation-mode"))
      .toBe("static-collapsed-history");
    const collapsedScope = timelineRoot?.getAttribute("data-timeline-presentation-scope");

    const showEarlierButton = container.querySelector<HTMLButtonElement>(
      ".messages-collapsed-indicator",
    );
    expect(showEarlierButton).toBeTruthy();
    fireEvent.click(showEarlierButton!);

    await waitFor(() => {
      expect(
        container
          .querySelector(".messages-timeline-root")
          ?.getAttribute("data-timeline-presentation-mode"),
      ).toBe("static-expanded-history-manual");
    });
    const expandedScope = container
      .querySelector(".messages-timeline-root")
      ?.getAttribute("data-timeline-presentation-scope");

    expect(expandedScope).toBeTruthy();
    expect(expandedScope).not.toBe(collapsedScope);
    expect(container.querySelector(".messages-virtualized-canvas")).toBeNull();
  });

  // A2:VISIBLE_MESSAGE_WINDOW=10000(95bc726a)有意禁用数量折叠,realtime-collapsed-tail 当前不启用;恢复折叠策略后去 skip。
  it.skip("uses a separate presentation scope for realtime tail windows", () => {
    const items: ConversationItem[] = Array.from({ length: 80 }, (_, index) => ({
      id: `presentation-live-${index + 1}`,
      kind: "message" as const,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      text: `presentation live message ${index + 1}`,
      isFinal: index < 79,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-presentation-live-scope"
        workspaceId="ws-heavy"
        isThinking={true}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const timelineRoot = container.querySelector(".messages-timeline-root");
    expect(timelineRoot?.getAttribute("data-timeline-presentation-mode"))
      .toBe("realtime-collapsed-tail");
    expect(timelineRoot?.getAttribute("data-timeline-presentation-scope"))
      .toContain("realtime-collapsed-tail");
    expect(container.querySelector("[data-timeline-virtualized='true']")).toBeNull();
  });

  it("does not inject lightweight summary cards while a heavy conversation is streaming", () => {
    const heavyMarkdown = [
      "# Streaming heavy answer",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 32 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 32 }, (_, index) => `const streamingValue${index} = ${index};`),
      "```",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 8 }, (_, index) => ({
      id: `streaming-heavy-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `${heavyMarkdown}\n\nchunk ${index + 1}`,
      isFinal: index < 7,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-heavy-streaming"
        workspaceId="ws-heavy"
        isThinking={true}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.queryByText("Heavy conversation detected")).toBeNull();
    expect(screen.queryByText("Deferred detail")).toBeNull();
    expect(container.querySelector("[data-timeline-virtualized='true']")).toBeNull();
    expect(screen.getAllByText(/Streaming heavy answer/).length).toBeGreaterThan(0);
  });

  it("pins bottom when reopening dense history that may virtualize", () => {
    const oversizedMarkdown = [
      "# Oversized section",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 90 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 44 }, (_, index) => `const oversizedValue${index} = ${index};`),
      "```",
      "<tool_call><invoke name=\"read_file\" /></tool_call>",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 12 }, (_, index) => ({
      id: `oversized-u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `${oversizedMarkdown}\n\n${index + 1}`,
    }));

    const renderWith = (threadId: string | null, visibleItems: ConversationItem[]) => (
      <Messages
        items={visibleItems}
        threadId={threadId}
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(
      renderWith("thread-oversized-prompt", items),
    );

    const scroller = container.querySelector(".messages") as HTMLDivElement;
    let scrollTop = 0;
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 720 },
      scrollHeight: { configurable: true, value: 4_000 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      },
    });

    rerender(renderWith(null, []));
    rerender(renderWith("thread-oversized-prompt", items));

    // Reopen should re-pin near bottom regardless of virtualized vs static path.
    expect(scroller.scrollTop).toBe(4_000 - 720);
  });

  it("does not flip into virtualization during same-frame streaming churn", () => {
    const buildItems = (count: number): ConversationItem[] =>
      Array.from({ length: count }, (_, index) => ({
        id: `flip-u${index + 1}`,
        kind: "message" as const,
        role: "user" as const,
        text: `message ${index + 1}`,
      }));
    const renderWith = (items: ConversationItem[], thinking: boolean) => (
      <Messages
        items={items}
        threadId="thread-flip-disabled"
        workspaceId="ws-flip"
        isThinking={thinking}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(buildItems(20), false));
    rerender(renderWith(buildItems(20), true));
    rerender(renderWith(buildItems(21), true));

    expect(
      container.querySelector(".messages-full")?.getAttribute("data-timeline-virtualized"),
    ).toBe("false");
    expect(container.querySelector(".messages-virtualized-canvas")).toBeNull();
    expect(container.querySelector('[data-message-anchor-id="flip-u21"]')).toBeTruthy();
    expect(measureMock).not.toHaveBeenCalled();
    expect(measureElementMock).not.toHaveBeenCalled();
  });
});
