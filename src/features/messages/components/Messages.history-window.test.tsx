// @vitest-environment jsdom
/**
 * 03 号清单「历史分页窗口」定标与上界断言。
 *
 * - 定标：混合会话（正文 + 工具输出 + diff + 代码块）真实渲染，数 DOM 节点，
 *   得出单条消息平均节点数（realtime Markdown，不 mock）。
 * - 上界：flag ccgui.perf.historyWindowSize 开启后，500 条会话的 DOM 节点数
 *   不得随消息数线性增长（与 200 条对照）。
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";
import { HISTORY_WINDOW_SIZE_FLAG_KEY } from "../orchestration/presentation/messagesHistoryWindow";

const ASSISTANT_MARKDOWN = [
  "这是一段正文，包含 **加粗** 与 `inline code`，用于模拟真实排版成本。",
  "",
  "```ts",
  "export function demo(input: string): number {",
  "  return input.length * 2;",
  "}",
  "```",
  "",
  "- 列表项一",
  "- 列表项二",
].join("\n");

const TOOL_OUTPUT = Array.from(
  { length: 40 },
  (_, index) => `src/module/file-${index}.ts: export const value${index} = ${index};`,
).join("\n");

const DIFF_TEXT = [
  "@@ -1,6 +1,7 @@",
  " line one",
  "-old line two",
  "+new line two",
  "+added line",
  " line three",
  " line four",
].join("\n");

function buildMixedItems(count: number): ConversationItem[] {
  const items: ConversationItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const slot = index % 5;
    if (slot === 0) {
      items.push({
        id: `user-${index}`,
        kind: "message",
        role: "user",
        text: `第 ${index} 轮：请继续处理这个任务。`,
      });
    } else if (slot === 1) {
      items.push({
        id: `assistant-${index}`,
        kind: "message",
        role: "assistant",
        text: ASSISTANT_MARKDOWN,
        isFinal: true,
      });
    } else if (slot === 2) {
      items.push({
        id: `reasoning-${index}`,
        kind: "reasoning",
        summary: `思考第 ${index} 步`,
        content: `推理内容 ${index}：先检查输入，再给出结论。`,
      });
    } else if (slot === 3) {
      items.push({
        id: `tool-${index}`,
        kind: "tool",
        title: "rg --files",
        detail: "/workspace",
        toolType: "commandExecution",
        output: TOOL_OUTPUT,
        status: "completed",
      });
    } else {
      items.push({
        id: `diff-${index}`,
        kind: "diff",
        title: `src/module/file-${index}.ts`,
        diff: DIFF_TEXT,
        status: "completed",
      });
    }
  }
  return items;
}

function countDomNodes(container: HTMLElement) {
  const scroller = container.querySelector(".messages");
  expect(scroller).toBeTruthy();
  return (scroller as HTMLElement).querySelectorAll("*").length;
}

describe("Messages history window DOM calibration", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  beforeEach(() => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "0");
    window.localStorage.removeItem(HISTORY_WINDOW_SIZE_FLAG_KEY);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(HISTORY_WINDOW_SIZE_FLAG_KEY);
  });

  it("measures per-item DOM node cost on a 100-item mixed conversation", () => {
    const items = buildMixedItems(100);
    const { container } = render(
      <Messages
        items={items}
        threadId="thread-dom-calibration-100"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const nodeCount = countDomNodes(container);
    // eslint-disable-next-line no-console
    console.info(
      `[history-window][calibration] items=100 domNodes=${nodeCount} perItem=${(
        nodeCount / 100
      ).toFixed(1)}`,
    );
    expect(nodeCount).toBeGreaterThan(0);
  });

  it("keeps DOM node count bounded: 500 items ≈ 200 items under the window flag", () => {
    window.localStorage.setItem(HISTORY_WINDOW_SIZE_FLAG_KEY, "150");
    const renderAndCount = (count: number) => {
      const { container, unmount } = render(
        <Messages
          items={buildMixedItems(count)}
          threadId={`thread-dom-bound-${count}`}
          workspaceId="ws-1"
          isThinking={false}
          activeEngine="claude"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const nodeCount = countDomNodes(container);
      unmount();
      return nodeCount;
    };

    const nodes200 = renderAndCount(200);
    const nodes500 = renderAndCount(500);
    // eslint-disable-next-line no-console
    console.info(
      `[history-window][bound] window=150 items=200 domNodes=${nodes200} items=500 domNodes=${nodes500}`,
    );
    // 窗口裁剪后 DOM 只保留最近一段：500 条不得比 200 条多出 20% 以上
    // （余量留给 chrome / 锚点轨道等条数弱相关节点）。
    expect(nodes500).toBeLessThanOrEqual(Math.ceil(nodes200 * 1.2));
  });

  it("renders the full conversation when the window flag is off", () => {
    // flag 测试默认 0（关闭）：恢复全量，无 chip。
    const items = buildMixedItems(200);
    const { container } = render(
      <Messages
        items={items}
        threadId="thread-dom-flag-off"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    expect(container.querySelector(".messages-collapsed-indicator")).toBeNull();
    expect(container.textContent ?? "").toContain("第 0 轮");
  });

  it("does not pour collapsed history back into the DOM when streaming settles", () => {
    window.localStorage.setItem(HISTORY_WINDOW_SIZE_FLAG_KEY, "150");
    const items = buildMixedItems(300);
    const renderWith = (isThinking: boolean) => (
      <Messages
        items={items}
        threadId="thread-dom-settle"
        workspaceId="ws-1"
        isThinking={isThinking}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(true));

    const chipBefore = container.querySelector(".messages-collapsed-indicator");
    const collapsedBefore = chipBefore?.getAttribute("data-collapsed-count");
    expect(Number(collapsedBefore)).toBeGreaterThan(0);
    const nodesStreaming = countDomNodes(container);

    // settle：isThinking false。旧事故是「尾窗→全量」切换灌回整段历史；
    // 历史窗口无模式切换，收起段必须保持收起，DOM 不得暴涨。
    rerender(renderWith(false));

    const chipAfter = container.querySelector(".messages-collapsed-indicator");
    expect(chipAfter?.getAttribute("data-collapsed-count")).toBe(collapsedBefore);
    expect(countDomNodes(container)).toBeLessThanOrEqual(
      Math.ceil(nodesStreaming * 1.1),
    );
    expect(container.textContent ?? "").not.toContain("第 0 轮");
  });
});
