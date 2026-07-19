// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

function findTextNode(root: Element, text: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.textContent?.includes(text)) {
      return current as Text;
    }
    current = walker.nextNode();
  }
  throw new Error(`Text node not found: ${text}`);
}

describe("Messages note capture", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    cleanup();
  });

  it("captures only the semantic whole-conversation body", () => {
    const onCaptureNote = vi.fn();
    const items: ConversationItem[] = [
      { id: "user-1", kind: "message", role: "user", text: "请保留需求正文" },
      {
        id: "reasoning-1",
        kind: "reasoning",
        summary: "不应保存的推理",
        content: "内部分析",
      },
      {
        id: "assistant-live",
        kind: "message",
        role: "assistant",
        text: "不应保存的流式半成品",
        isFinal: false,
      },
      {
        id: "assistant-final",
        kind: "message",
        role: "assistant",
        text: "这是最终答复",
        isFinal: true,
      },
    ];
    const { container } = render(
      <Messages
        items={items}
        threadId="thread-semantic"
        workspaceId="workspace-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onCaptureNote={onCaptureNote}
      />,
    );

    fireEvent.contextMenu(container.querySelector(".messages") as HTMLElement, {
      clientX: 120,
      clientY: 80,
    });
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "noteCards.captureConversationThread",
      }),
    );

    expect(onCaptureNote).toHaveBeenCalledTimes(1);
    const draft = onCaptureNote.mock.calls[0]?.[0];
    expect(draft).toMatchObject({
      title: "noteCards.captureConversationThreadTitle",
      source: {
        kind: "conversationThread",
        threadId: "thread-semantic",
        itemCount: 2,
      },
    });
    expect(draft.bodyMarkdown).toContain("请保留需求正文");
    expect(draft.bodyMarkdown).toContain("这是最终答复");
    expect(draft.bodyMarkdown).not.toContain("不应保存的推理");
    expect(draft.bodyMarkdown).not.toContain("不应保存的流式半成品");
  });

  it("opens the shared capture menu from the latest final action group", () => {
    const onCaptureNote = vi.fn();
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-first",
            kind: "message",
            role: "user",
            text: "第一轮问题",
          },
          {
            id: "assistant-first",
            kind: "message",
            role: "assistant",
            text: "第一轮答复",
            isFinal: true,
          },
          {
            id: "user-latest",
            kind: "message",
            role: "user",
            text: "最新问题",
          },
          {
            id: "assistant-latest",
            kind: "message",
            role: "assistant",
            text: "最新答复",
            isFinal: true,
          },
        ]}
        threadId="thread-action-trigger"
        workspaceId="workspace-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onCaptureNote={onCaptureNote}
        onForkFromMessage={vi.fn()}
        onRewindFromMessage={vi.fn()}
      />,
    );

    const boundaryActionRows = container.querySelectorAll(
      ".messages-final-boundary .message-action-bar-row",
    );
    expect(boundaryActionRows).toHaveLength(2);
    expect(boundaryActionRows[0].querySelectorAll("button")).toHaveLength(1);
    const latestActionButtons = Array.from(
      boundaryActionRows[1].querySelectorAll("button"),
    );
    expect(
      latestActionButtons.map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "noteCards.captureMenu",
      "messages.copyMessage",
      "messages.forkMessage",
      "messages.rewindMessage",
    ]);
    const noteCaptureIcon = latestActionButtons[0]?.querySelector("svg");
    expect(noteCaptureIcon?.getAttribute("width")).toBe("9");
    expect(noteCaptureIcon?.getAttribute("height")).toBe("9");
    expect(noteCaptureIcon?.getAttribute("stroke-width")).toBe("1.75");
    expect(
      latestActionButtons[3]
        ?.querySelector(".codicon-history")
        ?.classList.contains("message-history-icon"),
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "noteCards.captureMenu" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "noteCards.captureConversationThread",
      }),
    );

    expect(onCaptureNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "noteCards.captureConversationThreadTitle",
        source: {
          kind: "conversationThread",
          threadId: "thread-action-trigger",
          itemCount: 4,
          capturedAt: expect.any(Number),
        },
      }),
    );
  });

  it("freezes the local text selection for both copy and note capture", async () => {
    const onCaptureNote = vi.fn();
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-selection",
            kind: "message",
            role: "user",
            text: "保留这段局部文本",
          },
          {
            id: "assistant-other",
            kind: "message",
            role: "assistant",
            text: "另一条消息",
            isFinal: true,
          },
        ]}
        threadId="thread-selection"
        workspaceId="workspace-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onCaptureNote={onCaptureNote}
      />,
    );
    const message = container.querySelector(
      '[data-message-anchor-id="user-selection"]',
    );
    if (!message) {
      throw new Error("Expected selected message");
    }
    const textNode = findTextNode(message, "保留这段局部文本");
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(textNode);
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.contextMenu(message, { clientX: 150, clientY: 100 });
    expect(
      screen.getByRole("menuitem", { name: "messages.copy" }),
    ).toBeTruthy();
    selection?.removeAllRanges();
    fireEvent.click(screen.getByRole("menuitem", { name: "messages.copy" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith("保留这段局部文本");
    });

    selection?.addRange(range);
    fireEvent.contextMenu(message, { clientX: 150, clientY: 100 });
    selection?.removeAllRanges();
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "noteCards.captureConversationSelection",
      }),
    );

    expect(onCaptureNote).toHaveBeenCalledWith({
      title: "保留这段局部文本",
      bodyMarkdown: "保留这段局部文本",
      source: {
        kind: "conversationSelection",
        threadId: "thread-selection",
        itemIds: ["user-selection"],
      },
    });
  });

  it("does not take over context menus owned by links or interactive controls", () => {
    const onCaptureNote = vi.fn();
    const { container } = render(
      <Messages
        items={[
          {
            id: "assistant-final",
            kind: "message",
            role: "assistant",
            text: "Final answer",
            isFinal: true,
          },
        ]}
        threadId="thread-owned-menu"
        workspaceId="workspace-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onCaptureNote={onCaptureNote}
      />,
    );
    const canvas = container.querySelector(".messages");
    if (!canvas) {
      throw new Error("Expected conversation canvas");
    }
    const existingControl = canvas.querySelector("button");
    if (existingControl) {
      fireEvent.contextMenu(existingControl);
      expect(
        screen.queryByRole("menuitem", {
          name: "noteCards.captureConversationThread",
        }),
      ).toBeNull();
    }

    const fileLink = document.createElement("a");
    fileLink.href = "#src/example.ts";
    fileLink.textContent = "src/example.ts";
    canvas.append(fileLink);
    fireEvent.contextMenu(fileLink);

    expect(
      screen.queryByRole("menuitem", {
        name: "noteCards.captureConversationThread",
      }),
    ).toBeNull();
    expect(onCaptureNote).not.toHaveBeenCalled();
  });
});
