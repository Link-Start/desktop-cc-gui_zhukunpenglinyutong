import { describe, expect, it, vi } from "vitest";
import type { ConversationItem, RequestUserInputRequest } from "../../../types";
import type { MessagesProps } from "../types/messagesTypes";
import { adaptLegacyMessagesProps } from "./messagesInput";

const legacyItem: ConversationItem = {
  id: "legacy-item",
  kind: "message",
  role: "assistant",
  text: "legacy",
};

function buildProps(overrides: Partial<MessagesProps> = {}): MessagesProps {
  return {
    items: [legacyItem],
    threadId: "thread-current",
    workspaceId: "workspace-current",
    isThinking: false,
    openTargets: [],
    selectedOpenAppId: "",
    ...overrides,
  };
}

describe("adaptLegacyMessagesProps", () => {
  it("uses matching canonical state including explicit empty collections", () => {
    const request: RequestUserInputRequest = {
      workspace_id: "workspace-current",
      request_id: 1,
      params: {
        thread_id: "thread-current",
        turn_id: "turn-current",
        item_id: "item-current",
        questions: [],
      },
    };
    const result = adaptLegacyMessagesProps(buildProps({
      userInputRequests: [request],
      conversationState: {
        items: [],
        plan: null,
        userInputQueue: [],
        meta: {
          workspaceId: "workspace-current",
          threadId: "thread-current",
          engine: "codex",
          activeTurnId: null,
          isThinking: true,
          heartbeatPulse: 4,
          historyRestoredAtMs: null,
        },
      },
    }));

    expect(result.conversation.state.items).toEqual([]);
    expect(result.conversation.state.userInputQueue).toEqual([]);
    expect(result.conversation.state.meta.engine).toBe("codex");
    expect(result.conversation.state.meta.isThinking).toBe(true);
  });

  it("rejects canonical state from another workspace or thread", () => {
    const result = adaptLegacyMessagesProps(buildProps({
      activeEngine: "kimi",
      conversationState: {
        items: [{ ...legacyItem, id: "stale-item", text: "stale" }],
        plan: { turnId: "stale", explanation: "stale", steps: [] },
        userInputQueue: [],
        meta: {
          workspaceId: "workspace-stale",
          threadId: "thread-stale",
          engine: "claude",
          activeTurnId: null,
          isThinking: true,
          heartbeatPulse: 9,
          historyRestoredAtMs: null,
        },
      },
    }));

    expect(result.conversation.state.items).toEqual([legacyItem]);
    expect(result.conversation.state.meta.workspaceId).toBe("workspace-current");
    expect(result.conversation.state.meta.threadId).toBe("thread-current");
    expect(result.conversation.state.meta.engine).toBe("kimi");
  });

  it("maps callbacks and runtime collections without changing references", () => {
    const onOpenWorkspaceFile = vi.fn();
    const approvals: NonNullable<MessagesProps["approvals"]> = [];
    const taskRuns: NonNullable<MessagesProps["taskRuns"]> = [];
    const result = adaptLegacyMessagesProps(buildProps({
      approvals,
      taskRuns,
      onOpenWorkspaceFile,
    }));

    expect(result.runtime.approvals).toBe(approvals);
    expect(result.runtime.taskRuns).toBe(taskRuns);
    expect(result.interactions.onOpenWorkspaceFile).toBe(onOpenWorkspaceFile);
  });
});
