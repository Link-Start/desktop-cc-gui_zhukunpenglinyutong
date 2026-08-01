// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useThreadLinking } from "./useThreadLinking";

describe("useThreadLinking", () => {
  it("projects a live Codex subagent activity into the child row atomically", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadLinking({ dispatch, threadParentById: {} }),
    );

    act(() => {
      result.current.applyCollabThreadLinks(
        "parent-thread",
        {
          type: "subAgentActivity",
          id: "activity-1",
          kind: "started",
          agentThreadId: "child-thread",
          agentPath: "/root/review_webview_lifecycle",
        },
        "ws-1",
      );
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "child-thread",
      engine: "codex",
      parentThreadId: "parent-thread",
      name: "review_webview_lifecycle",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadParent",
      threadId: "child-thread",
      parentId: "parent-thread",
    });
  });

  it("recognizes persisted snake_case subagent activity during thread hydration", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadLinking({ dispatch, threadParentById: {} }),
    );

    act(() => {
      result.current.applyCollabThreadLinksFromThread(
        "parent-thread",
        {
          turns: [
            {
              items: [
                {
                  type: "sub_agent_activity",
                  kind: "started",
                  agent_thread_id: "child-thread",
                  agent_path: "/root/review_tests_regression",
                },
              ],
            },
          ],
        },
      );
    });

    expect(dispatch).toHaveBeenCalledWith(
      {
        type: "setThreadParent",
        threadId: "child-thread",
        parentId: "parent-thread",
      },
    );
  });
});
