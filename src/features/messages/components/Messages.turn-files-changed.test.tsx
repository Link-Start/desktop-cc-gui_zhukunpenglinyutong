// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

function userMessage(id: string): ConversationItem {
  return { id, kind: "message", role: "user", text: `Q-${id}` };
}

function finalAssistant(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text: `A-${id}`,
    isFinal: true,
  };
}

function editTool(
  id: string,
  filePath: string,
  oldString: string,
  newString: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "edit",
    title: "Tool: edit",
    detail: JSON.stringify({
      file_path: filePath,
      old_string: oldString,
      new_string: newString,
    }),
    status: "completed",
    output: "ok",
  };
}

function renderMessages(items: ConversationItem[]) {
  return render(
    <Messages
      items={items}
      threadId="thread-1"
      workspaceId="ws-1"
      isThinking={false}
      activeEngine="codex"
      openTargets={[]}
      selectedOpenAppId=""
    />,
  );
}

describe("Messages turn files changed cards", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.removeItem("ccgui.messages.live.collapseMiddleSteps");
  });

  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  it("renders the session summary card at the timeline tail instead of an inline card for the latest turn", () => {
    const { container } = renderMessages([
      userMessage("u1"),
      editTool("t1", "src/a.ts", "old", "new\nnew2"),
      finalAssistant("a1"),
    ]);

    const cards = container.querySelectorAll(".turn-files-changed-card");
    expect(cards).toHaveLength(1);
    expect(
      container.querySelector(".messages-session-files-changed"),
    ).toBeTruthy();
  });

  it("keeps inline cards for earlier turns and accumulates the session card", () => {
    const { container } = renderMessages([
      userMessage("u1"),
      editTool("t1", "src/a.ts", "a", "b"),
      finalAssistant("a1"),
      userMessage("u2"),
      editTool("t2", "src/b.ts", "", "one\ntwo"),
      finalAssistant("a2"),
    ]);

    const cards = container.querySelectorAll(".turn-files-changed-card");
    // 第一轮内联卡 + 底部会话累计卡
    expect(cards).toHaveLength(2);
    const sessionCard = container.querySelector(
      ".messages-session-files-changed .turn-files-changed-card",
    );
    expect(sessionCard).toBeTruthy();
    // 会话卡累计两轮的两个文件
    expect(sessionCard?.textContent ?? "").toContain("a.ts");
    expect(sessionCard?.textContent ?? "").toContain("b.ts");
  });

  it("pins the completed turn's inline card and hides the session card while a new turn is pending", () => {
    const { container } = renderMessages([
      userMessage("u1"),
      editTool("t1", "src/a.ts", "old", "new\nnew2"),
      finalAssistant("a1"),
      // 用户又发了新问题，本回合还没有最终回复 = 有新回合进行中
      userMessage("u2"),
    ]);

    // 上一轮的汇总钉在它自己的回合边界（内联卡），不再飘到末尾
    const cards = container.querySelectorAll(".turn-files-changed-card");
    expect(cards).toHaveLength(1);
    // 末尾会话累计卡在新回合进行中时不渲染，避免落到新问题之后
    expect(container.querySelector(".messages-session-files-changed")).toBeNull();
  });

  it("renders no cards when the conversation has no file edits", () => {
    const { container } = renderMessages([
      userMessage("u1"),
      finalAssistant("a1"),
    ]);

    expect(container.querySelectorAll(".turn-files-changed-card")).toHaveLength(0);
    expect(container.querySelector(".messages-session-files-changed")).toBeNull();
  });
});
