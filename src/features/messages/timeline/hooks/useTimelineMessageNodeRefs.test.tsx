// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineMessageNodeBinding } from "../components/TimelineRowRenderer.types";
import { useTimelineMessageNodeRefs } from "./useTimelineMessageNodeRefs";

describe("useTimelineMessageNodeRefs", () => {
  it("resynchronizes task identities for an already mounted message node", () => {
    const taskNodes = new Map<string, HTMLDivElement>();
    const toolUseNodes = new Map<string, HTMLDivElement>();
    const messageNodes = new Map<string, HTMLDivElement>();
    const initialBinding: TimelineMessageNodeBinding = {
      role: "assistant",
      taskId: "task-1",
      toolUseId: "tool-1",
    };
    const { result, rerender } = renderHook(
      ({ binding }) => useTimelineMessageNodeRefs({
        agentTaskNodeByTaskIdRef: { current: taskNodes },
        agentTaskNodeByToolUseIdRef: { current: toolUseNodes },
        messageNodeByIdRef: { current: messageNodes },
      }).getRef("message-1", binding),
      { initialProps: { binding: initialBinding } },
    );
    const node = document.createElement("div");
    act(() => result.current(node));

    rerender({
      binding: {
        role: "assistant",
        taskId: "task-2",
        toolUseId: "tool-2",
      },
    });

    expect(taskNodes.get("task-1")).toBeUndefined();
    expect(toolUseNodes.get("tool-1")).toBeUndefined();
    expect(taskNodes.get("task-2")).toBe(node);
    expect(toolUseNodes.get("tool-2")).toBe(node);
  });
});
