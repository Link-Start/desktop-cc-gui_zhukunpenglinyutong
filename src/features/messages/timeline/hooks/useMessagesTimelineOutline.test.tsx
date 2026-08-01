// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMessageOutlineActive } from "../../hooks/useMessageOutlineActive";
import { useMessagesTimelineOutline } from "./useMessagesTimelineOutline";

vi.mock("../../hooks/useMessageOutlineActive", () => ({
  useMessageOutlineActive: vi.fn(() => ({ activeHeadingId: null })),
}));

describe("useMessagesTimelineOutline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the live callback stable and passes no outline while disabled", () => {
    const { result, rerender } = renderHook(
      (props: { messageId: string; threadId: string }) => useMessagesTimelineOutline({
        enabled: false,
        liveAssistantMessageId: props.messageId,
        threadId: props.threadId,
        workspaceId: "workspace-1",
      }),
      { initialProps: { messageId: "assistant-1", threadId: "thread-1" } },
    );
    const firstCallback = result.current.liveAssistantOutlineReady;

    act(() => {
      firstCallback?.([{
        id: "heading-1",
        depth: 2,
        title: "Heading",
        startLine: 1,
        endLine: 2,
        anchor: "heading-1",
        ordinal: 0,
      }]);
    });
    expect(result.current.currentOutline?.messageId).toBe("assistant-1");

    rerender({ messageId: "assistant-1", threadId: "thread-1" });
    expect(result.current.liveAssistantOutlineReady).toBe(firstCallback);
    expect(vi.mocked(useMessageOutlineActive).mock.lastCall?.[0]).toBeNull();
  });

  it("resets the snapshot when timeline scope changes", () => {
    const { result, rerender } = renderHook(
      ({ threadId }) => useMessagesTimelineOutline({
        enabled: false,
        liveAssistantMessageId: "assistant-1",
        threadId,
        workspaceId: "workspace-1",
      }),
      { initialProps: { threadId: "thread-1" } },
    );
    act(() => {
      result.current.liveAssistantOutlineReady?.([]);
    });
    expect(result.current.currentOutline).not.toBeNull();

    rerender({ threadId: "thread-2" });
    expect(result.current.currentOutline).toBeNull();
  });
});
